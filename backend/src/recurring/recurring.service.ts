import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  addDays,
  ISO_DATE_RE,
  IsoDate,
  occurrenceOnOrAfter,
  PRIORITIES,
  Priority,
  Recurrence,
  RECURRENCE_FREQUENCIES,
  RECURRENCE_INTERVAL_MAX,
  RecurrenceFrequency,
  RecurringTask,
  RecurringTaskInput,
} from '@hogar/shared';
import { parseAssigneeIds } from '../common/assignees';
import { TIME_ZONE, todayIso } from '../common/dates';
import { asObject, oneOf, requiredText } from '../common/validation';
import { Prisma } from '../generated/prisma/client';
import { householdUses } from '../households/section.guard';
import { PrismaService } from '../prisma/prisma.service';

const CATEGORY_MAX = 40;
const NOTES_MAX = 2000;

const include = { assignees: { select: { userId: true } } } as const;
type Row = Prisma.RecurringTaskGetPayload<{ include: typeof include }>;

const toRecurrence = (r: Row): Recurrence => ({
  frequency: r.frequency as RecurrenceFrequency,
  interval: r.interval,
  weekdays: r.weekdays ? r.weekdays.split(',').map(Number) : [],
  startDate: r.startDate,
});

const toRecurring = (r: Row): RecurringTask => ({
  id: r.id,
  title: r.title,
  notes: r.notes,
  priority: r.priority as Priority,
  category: r.category,
  assigneeIds: r.assignees.map((a) => a.userId),
  ...toRecurrence(r),
  nextDate: r.nextDate,
  active: r.active,
  createdById: r.createdById,
  createdAt: r.createdAt.toISOString(),
});

type Fields = Partial<Omit<RecurringTaskInput, 'weekdays'>> & { weekdays?: number[] };

/**
 * Tareas recurrentes: plantillas que crean una tarea cada vez que toca. Cada noche (y al arrancar,
 * por si el servidor estaba apagado) se crean las de hoy. Si la tarea anterior de una plantilla
 * sigue sin hacer, no se crea otra: se salta esa fecha.
 */
@Injectable()
export class RecurringService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RecurringService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    await this.nightly();
  }

  @Cron('0 1 0 * * *', { timeZone: TIME_ZONE })
  async nightly(): Promise<void> {
    try {
      const created = await this.generateDue(todayIso());
      if (created) this.logger.log(`Tareas recurrentes creadas: ${created}`);
    } catch (err) {
      this.logger.error(`No se pudieron crear las tareas recurrentes: ${(err as Error).message}`);
    }
  }

  /** Crea las tareas de todas las plantillas a las que ya les toca. @returns cuántas ha creado. */
  async generateDue(today: IsoDate): Promise<number> {
    // Las casas que ocultan Tareas no reciben tareas nuevas (siguen al volver a mostrarlas).
    const due = await this.prisma.recurringTask.findMany({
      where: { active: true, nextDate: { lte: today }, household: householdUses('tareas') },
      include,
    });
    let created = 0;
    for (const row of due) if (await this.generate(row, today)) created++;
    return created;
  }

  async list(householdId: string): Promise<RecurringTask[]> {
    const rows = await this.prisma.recurringTask.findMany({ where: { householdId }, include, orderBy: { createdAt: 'asc' } });
    return rows.map(toRecurring);
  }

  async create(householdId: string, createdById: string, body: unknown): Promise<RecurringTask> {
    const f = await this.validate(householdId, body, false);
    const recurrence = withDefaults(f);
    const today = todayIso();
    const row = await this.prisma.recurringTask.create({
      data: {
        householdId,
        createdById,
        title: f.title!,
        notes: f.notes ?? '',
        priority: f.priority!,
        category: f.category ?? null,
        assignees: { create: (f.assigneeIds ?? []).map((userId) => ({ userId })) },
        ...stored(recurrence),
        nextDate: occurrenceOnOrAfter(recurrence, today),
        active: f.active ?? true,
      },
      include,
    });
    // Si empieza hoy, la primera tarea aparece ya.
    if (row.active && row.nextDate <= today) await this.generate(row, today);
    return this.get(row.id);
  }

  async update(householdId: string, id: string, body: unknown): Promise<RecurringTask> {
    const current = await this.find(householdId, id);
    const f = await this.validate(householdId, body, true);
    const recurrence = withDefaults({ ...toRecurrence(current), ...f });
    const today = todayIso();
    const scheduleChanged =
      f.frequency !== undefined || f.interval !== undefined || f.weekdays !== undefined || f.startDate !== undefined;
    const reactivated = f.active === true && !current.active;

    const data: Prisma.RecurringTaskUpdateInput = {
      title: f.title,
      notes: f.notes,
      priority: f.priority,
      category: f.category,
      active: f.active,
      assignees: f.assigneeIds && { deleteMany: {}, create: f.assigneeIds.map((userId) => ({ userId })) },
    };
    if (scheduleChanged || reactivated) {
      Object.assign(data, stored(recurrence));
      // Desde hoy (lo que se perdió estando en pausa no se recupera), sin repetir una fecha ya tratada.
      const from = current.lastDate && current.lastDate >= today ? addDays(current.lastDate, 1) : today;
      data.nextDate = occurrenceOnOrAfter(recurrence, from);
    }
    const row = await this.prisma.recurringTask.update({ where: { id }, data, include });
    if (row.active && row.nextDate <= today) await this.generate(row, today);
    return this.get(id);
  }

  async remove(householdId: string, id: string): Promise<void> {
    await this.find(householdId, id);
    // Las tareas que ya creó se quedan (pierden el enlace).
    await this.prisma.recurringTask.delete({ where: { id } });
  }

  /**
   * Trata la fecha que le toca a una plantilla. Si el servidor estuvo apagado varios días,
   * crea una sola tarea, con la fecha más reciente, y no una por cada día perdido.
   * @returns true si ha creado una tarea.
   */
  private async generate(row: Row, today: IsoDate): Promise<boolean> {
    const recurrence = toRecurrence(row);
    let date = row.nextDate;
    let next = occurrenceOnOrAfter(recurrence, addDays(date, 1));
    while (next <= today) {
      date = next;
      next = occurrenceOnOrAfter(recurrence, addDays(date, 1));
    }

    const previous = await this.prisma.task.findFirst({
      where: { recurringId: row.id },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });
    const pending = !!previous && previous.status !== 'hecho';

    return this.prisma.$transaction(async (tx) => {
      // Solo avanza si nadie lo ha hecho entre medias (por ejemplo, el cron y una edición a la vez).
      const claimed = await tx.recurringTask.updateMany({
        where: { id: row.id, nextDate: row.nextDate },
        data: { nextDate: next, lastDate: date },
      });
      if (!claimed.count || pending) return false;
      await tx.task.create({
        data: {
          householdId: row.householdId,
          createdById: row.createdById,
          recurringId: row.id,
          title: row.title,
          notes: row.notes,
          priority: row.priority,
          category: row.category,
          due: date,
          assignees: { create: row.assignees.map(({ userId }) => ({ userId })) },
        },
      });
      return true;
    });
  }

  private async get(id: string): Promise<RecurringTask> {
    return toRecurring(await this.prisma.recurringTask.findUniqueOrThrow({ where: { id }, include }));
  }

  private async find(householdId: string, id: string) {
    const row = await this.prisma.recurringTask.findFirst({ where: { id, householdId }, include });
    if (!row) throw new NotFoundException('La tarea recurrente no existe');
    return row;
  }

  private async validate(householdId: string, body: unknown, partial: boolean): Promise<Fields> {
    const b = asObject(body);
    const out: Fields = {};
    const has = (key: string) => b[key] !== undefined || !partial;

    if (has('title')) out.title = requiredText(b['title'], 'El título', 120);
    if (b['notes'] !== undefined) {
      const notes = typeof b['notes'] === 'string' ? b['notes'].trim() : '';
      if (notes.length > NOTES_MAX) throw new BadRequestException(`Las notas no pueden pasar de ${NOTES_MAX} caracteres`);
      out.notes = notes;
    }
    if (has('priority')) out.priority = oneOf(b['priority'], PRIORITIES, 'Prioridad');
    if (b['category'] !== undefined) {
      const category = typeof b['category'] === 'string' ? b['category'].trim() : '';
      if (category.length > CATEGORY_MAX) throw new BadRequestException(`La categoría no puede pasar de ${CATEGORY_MAX} caracteres`);
      out.category = category || null;
    }
    if (b['assigneeIds'] !== undefined) out.assigneeIds = await parseAssigneeIds(this.prisma, householdId, b['assigneeIds']);
    if (has('frequency')) out.frequency = oneOf(b['frequency'], RECURRENCE_FREQUENCIES, 'Frecuencia');
    if (b['interval'] !== undefined) {
      const n = b['interval'];
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > RECURRENCE_INTERVAL_MAX) {
        throw new BadRequestException(`El intervalo tiene que ser un número entre 1 y ${RECURRENCE_INTERVAL_MAX}`);
      }
      out.interval = n;
    }
    if (b['weekdays'] !== undefined) {
      const days = b['weekdays'];
      if (!Array.isArray(days) || !days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)) {
        throw new BadRequestException('Días de la semana no válidos (1 = lunes … 7 = domingo)');
      }
      out.weekdays = [...new Set(days as number[])].sort();
    }
    if (has('startDate')) {
      const date = b['startDate'];
      if (typeof date !== 'string' || !ISO_DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
        throw new BadRequestException('Fecha de inicio no válida (AAAA-MM-DD)');
      }
      out.startDate = date;
    }
    if (b['active'] !== undefined) {
      if (typeof b['active'] !== 'boolean') throw new BadRequestException('active tiene que ser true o false');
      out.active = b['active'];
    }
    return out;
  }
}

/** Completa y comprueba la frecuencia: en "dias_semana" hacen falta días y el intervalo es 1. */
function withDefaults(f: Partial<Recurrence>): Recurrence {
  const frequency = f.frequency!;
  const weekdays = frequency === 'dias_semana' ? (f.weekdays ?? []) : [];
  if (frequency === 'dias_semana' && !weekdays.length) throw new BadRequestException('Elige al menos un día de la semana');
  return { frequency, interval: frequency === 'dias_semana' ? 1 : (f.interval ?? 1), weekdays, startDate: f.startDate! };
}

function stored(r: Recurrence) {
  return { frequency: r.frequency, interval: r.interval, weekdays: r.weekdays.join(','), startDate: r.startDate };
}
