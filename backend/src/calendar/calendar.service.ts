import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  addDays,
  addMonths,
  ageOn,
  Birthday,
  BIRTHDAY_NAME_MAX,
  BIRTHDAY_NOTICE_MAX,
  birthdayIn,
  CALENDAR_KINDS,
  CALENDAR_RANGE_MAX,
  CalendarEvent,
  CalendarItem,
  daysInMonth,
  EVENT_DAYS_MAX,
  EVENT_NOTES_MAX,
  EVENT_TITLE_MAX,
  formatEuros,
  IsoDate,
  Meal,
  MEAL_LABELS,
  ModuleKey,
  occurrenceOnOrAfter,
  RecurrenceFrequency,
  TASK_STATUS_LABELS,
  TaskStatus,
  TIME_RE,
  tidyName,
} from '@hogar/shared';
import { asObject, optionalText, requiredText } from '../common/validation';
import { date } from '../expenses/expenses.service';
import { Prisma } from '../generated/prisma/client';
import { parseHidden } from '../households/section.guard';
import { PrismaService } from '../prisma/prisma.service';

const toEvent = (r: Prisma.CalendarEventGetPayload<object>): CalendarEvent => ({
  id: r.id,
  title: r.title,
  date: r.date,
  endDate: r.endDate,
  time: r.time,
  notes: r.notes,
});

const toBirthday = (r: Prisma.BirthdayGetPayload<object>): Birthday => ({
  id: r.id,
  name: r.name,
  month: r.month,
  day: r.day,
  year: r.year,
  notifyDays: r.notifyDays,
});

/** Orden dentro de un día: lo propio del calendario primero, luego lo que viene de otras secciones. */
const KIND_ORDER = Object.fromEntries(CALENDAR_KINDS.map((k, i) => [k, i]));

/** Repeticiones como mucho que se calculan por tarea recurrente o factura (por si acaso). */
const MAX_REPEATS = 400;

/**
 * Calendario de una casa: sus eventos y cumpleaños, más lo que tiene fecha en las demás
 * secciones que use (tareas y recurrentes, menú y facturas).
 */
@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async items(householdId: string, fromValue: unknown, toValue: unknown): Promise<CalendarItem[]> {
    const from = date(fromValue, 'Fecha inicial'), to = date(toValue, 'Fecha final');
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    if (days < 0 || days > CALENDAR_RANGE_MAX) throw new BadRequestException(`Rango de fechas no válido (máximo ${CALENDAR_RANGE_MAX} días)`);
    const household = await this.prisma.household.findUniqueOrThrow({ where: { id: householdId }, select: { hiddenModules: true } });
    const hidden = parseHidden(household.hiddenModules);
    const uses = (key: ModuleKey) => !hidden.includes(key);
    const items: CalendarItem[] = [];
    const inRange = (d: IsoDate) => d >= from && d <= to;

    // Eventos: los que se solapan con el rango, uno por cada día que caiga dentro.
    const events = await this.prisma.calendarEvent.findMany({ where: { householdId, date: { lte: to } } });
    for (const e of events) {
      const end = e.endDate ?? e.date;
      if (end < from) continue;
      for (let d = e.date < from ? from : e.date; d <= end && d <= to; d = addDays(d, 1)) {
        const multi = !!e.endDate && e.endDate !== e.date;
        items.push(item('evento', d, e.title, e.id, null, {
          time: d === e.date ? e.time : null,
          detail: [d === e.date ? e.time : null, multi ? `hasta el ${shortDate(end)}` : null].filter(Boolean).join(' · ') || null,
        }));
      }
    }

    // Cumpleaños: cada año que toque el rango.
    for (const b of await this.prisma.birthday.findMany({ where: { householdId } })) {
      for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
        const d = birthdayIn(b, y);
        if (!inRange(d)) continue;
        const age = ageOn(b, d);
        items.push(item('cumple', d, `Cumpleaños de ${b.name}`, b.id, null, { detail: age !== null ? `Cumple ${age}` : null }));
      }
    }

    if (uses('tareas')) {
      const tasks = await this.prisma.task.findMany({
        where: { householdId, due: { gte: from, lte: to } },
        include: { assignees: { include: { user: { select: { name: true } } } } },
      });
      for (const t of tasks) {
        const people = t.assignees.map((a) => a.user.name.split(' ')[0]).join(', ');
        items.push(item('tarea', t.due!, t.title, t.id, '/tareas', {
          detail: [TASK_STATUS_LABELS[t.status as TaskStatus], people].filter(Boolean).join(' · '),
          done: t.status === 'hecho',
        }));
      }
      // Recurrentes: las próximas veces que tocan (las ya creadas salen como tareas).
      const recurring = await this.prisma.recurringTask.findMany({ where: { householdId, active: true } });
      for (const r of recurring) {
        const rec = {
          frequency: r.frequency as RecurrenceFrequency,
          interval: r.interval,
          weekdays: r.weekdays ? r.weekdays.split(',').map(Number) : [],
          startDate: r.startDate,
        };
        let d = occurrenceOnOrAfter(rec, r.nextDate > from ? r.nextDate : from);
        for (let n = 0; d <= to && n < MAX_REPEATS; n++, d = occurrenceOnOrAfter(rec, addDays(d, 1))) {
          items.push(item('recurrente', d, r.title, r.id, '/tareas/recurrentes', { detail: 'Se creará ese día' }));
        }
      }
    }

    if (uses('recetas')) {
      const menu = await this.prisma.menuEntry.findMany({
        where: { householdId, date: { gte: from, lte: to } },
        include: { recipe: { select: { name: true } } },
      });
      for (const m of menu) {
        items.push(item('menu', m.date, m.recipe.name, m.recipeId, `/recetas/${m.recipeId}`, {
          detail: `${MEAL_LABELS[m.meal as Meal]} · ${m.servings} rac.`,
          // Que la comida vaya antes que la cena.
          time: m.meal === 'comida' ? '14:00' : '21:00',
        }));
      }
    }

    if (uses('gastos')) {
      // Facturas: el próximo vencimiento y los siguientes, cada N meses.
      for (const b of await this.prisma.bill.findMany({ where: { householdId, active: true } })) {
        for (let n = 0; n < MAX_REPEATS; n++) {
          const d = addMonths(b.nextDue, n * b.interval);
          if (d > to) break;
          if (d >= from) {
            items.push(item('factura', d, `Vence ${b.name}`, b.id, '/gastos/facturas', { detail: b.amount ? `Unos ${formatEuros(b.amount)}` : null }));
          }
        }
      }
    }

    return items.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
        (a.time ?? '').localeCompare(b.time ?? '') ||
        a.title.localeCompare(b.title, 'es'),
    );
  }

  // --- Eventos ---

  async createEvent(householdId: string, userId: string, body: unknown): Promise<CalendarEvent> {
    const data = validateEvent(body);
    return toEvent(await this.prisma.calendarEvent.create({ data: { householdId, createdById: userId, ...data } }));
  }

  async updateEvent(householdId: string, id: string, body: unknown): Promise<CalendarEvent> {
    await this.findEvent(householdId, id);
    return toEvent(await this.prisma.calendarEvent.update({ where: { id }, data: validateEvent(body) }));
  }

  async getEvent(householdId: string, id: string): Promise<CalendarEvent> {
    return toEvent(await this.findEvent(householdId, id));
  }

  async removeEvent(householdId: string, id: string): Promise<void> {
    await this.findEvent(householdId, id);
    await this.prisma.calendarEvent.delete({ where: { id } });
  }

  // --- Cumpleaños ---

  async birthdays(householdId: string): Promise<Birthday[]> {
    const rows = await this.prisma.birthday.findMany({ where: { householdId }, orderBy: [{ month: 'asc' }, { day: 'asc' }, { name: 'asc' }] });
    return rows.map(toBirthday);
  }

  async createBirthday(householdId: string, body: unknown): Promise<Birthday> {
    return toBirthday(await this.prisma.birthday.create({ data: { householdId, ...validateBirthday(body) } }));
  }

  async updateBirthday(householdId: string, id: string, body: unknown): Promise<Birthday> {
    await this.findBirthday(householdId, id);
    return toBirthday(await this.prisma.birthday.update({ where: { id }, data: validateBirthday(body) }));
  }

  async removeBirthday(householdId: string, id: string): Promise<void> {
    await this.findBirthday(householdId, id);
    await this.prisma.birthday.delete({ where: { id } });
  }

  private async findEvent(householdId: string, id: string) {
    const row = await this.prisma.calendarEvent.findFirst({ where: { id, householdId } });
    if (!row) throw new NotFoundException('Ese evento no existe');
    return row;
  }

  private async findBirthday(householdId: string, id: string) {
    const row = await this.prisma.birthday.findFirst({ where: { id, householdId } });
    if (!row) throw new NotFoundException('Ese cumpleaños no existe');
    return row;
  }
}

function item(
  kind: CalendarItem['kind'],
  d: IsoDate,
  title: string,
  refId: string,
  link: string | null,
  extra: { detail?: string | null; time?: string | null; done?: boolean } = {},
): CalendarItem {
  return { kind, date: d, title, refId, link, detail: extra.detail ?? null, time: extra.time ?? null, done: extra.done ?? false };
}

/** "3 nov". */
function shortDate(d: IsoDate): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function validateEvent(body: unknown) {
  const b = asObject(body);
  const start = date(b['date']);
  const end = b['endDate'] === undefined || b['endDate'] === null || b['endDate'] === '' ? null : date(b['endDate'], 'Fecha de fin');
  if (end !== null) {
    const days = (Date.parse(end) - Date.parse(start)) / 86_400_000;
    if (days < 0) throw new BadRequestException('La fecha de fin no puede ser anterior al inicio');
    if (days > EVENT_DAYS_MAX) throw new BadRequestException('Un evento puede durar como mucho un año');
  }
  const time = optionalText(b['time'], 'La hora', 5);
  if (time !== null && !TIME_RE.test(time)) throw new BadRequestException('Hora no válida (HH:MM)');
  return {
    title: tidyName(requiredText(b['title'], 'El título', EVENT_TITLE_MAX)),
    date: start,
    endDate: end === start ? null : end,
    time,
    notes: optionalText(b['notes'], 'Las notas', EVENT_NOTES_MAX) ?? '',
  };
}

function validateBirthday(body: unknown) {
  const b = asObject(body);
  const month = int(b['month'], 'El mes', 1, 12);
  const day = int(b['day'], 'El día', 1, daysInMonth(month));
  const thisYear = new Date().getFullYear();
  const year = b['year'] === undefined || b['year'] === null ? null : int(b['year'], 'El año', 1900, thisYear);
  if (year !== null && day > daysInMonth(month, year)) throw new BadRequestException(`${year} no tuvo ${day} de febrero`);
  return {
    name: tidyName(requiredText(b['name'], 'El nombre', BIRTHDAY_NAME_MAX)),
    month,
    day,
    year,
    notifyDays: b['notifyDays'] === undefined ? 3 : int(b['notifyDays'], 'Los días de aviso', 0, BIRTHDAY_NOTICE_MAX),
  };
}

function int(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException(`${label} tiene que ser un número entre ${min} y ${max}`);
  }
  return value;
}
