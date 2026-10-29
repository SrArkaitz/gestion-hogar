import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ISO_DATE_RE, PRIORITIES, Priority, Task, TASK_ARCHIVE_DAYS, TASK_STATUSES, TaskInput, TaskStatus } from '@hogar/shared';
import { TIME_ZONE } from '../common/dates';
import { parseAssigneeIds } from '../common/assignees';
import { asObject, oneOf, requiredText } from '../common/validation';
import { Prisma } from '../generated/prisma/client';
import { PushService } from '../notifications/push.service';
import { PrismaService } from '../prisma/prisma.service';

const CATEGORY_MAX = 40;
const NOTES_MAX = 2000;

const include = { idea: { select: { id: true } }, assignees: { select: { userId: true } } } as const;
type Row = Prisma.TaskGetPayload<{ include: typeof include }>;

const toTask = (r: Row): Task => ({
  id: r.id,
  title: r.title,
  notes: r.notes,
  status: r.status as TaskStatus,
  priority: r.priority as Priority,
  due: r.due,
  category: r.category,
  personal: r.personal,
  assigneeIds: r.assignees.map((a) => a.userId),
  createdById: r.createdById,
  ideaId: r.idea?.id ?? null,
  recurringId: r.recurringId,
  doneAt: r.doneAt?.toISOString() ?? null,
  archivedAt: r.archivedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

/** Las del hogar y las personales de esa persona: las de los demás no se ven. */
const visibleTo = (userId: string): Prisma.TaskWhereInput => ({ OR: [{ personal: false }, { createdById: userId }] });

/** Cuántas archivadas se devuelven como mucho (las más recientes). */
const ARCHIVED_MAX = 200;

/**
 * Tareas de una casa. El HouseholdGuard ya ha comprobado que el usuario es miembro.
 * Las hechas se archivan solas a los TASK_ARCHIVE_DAYS días (cada noche y al arrancar).
 */
@Injectable()
export class TasksService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  async onApplicationBootstrap() {
    await this.nightly();
  }

  @Cron('0 5 0 * * *', { timeZone: TIME_ZONE })
  async nightly(): Promise<void> {
    try {
      const archived = await this.archiveOld(new Date());
      if (archived) this.logger.log(`Tareas hechas archivadas: ${archived}`);
    } catch (err) {
      this.logger.error(`No se pudieron archivar las tareas hechas: ${(err as Error).message}`);
    }
  }

  /** Archiva las que llevan TASK_ARCHIVE_DAYS días o más en Hecho. */
  async archiveOld(now: Date): Promise<number> {
    const limit = new Date(now.getTime() - TASK_ARCHIVE_DAYS * 86_400_000);
    const { count } = await this.prisma.task.updateMany({
      where: { status: 'hecho', archivedAt: null, doneAt: { lte: limit } },
      data: { archivedAt: now },
    });
    return count;
  }

  async list(householdId: string, userId: string, archived = false): Promise<Task[]> {
    const rows = await this.prisma.task.findMany({
      where: { householdId, ...visibleTo(userId), archivedAt: archived ? { not: null } : null },
      include,
      orderBy: archived ? { archivedAt: 'desc' } : { createdAt: 'asc' },
      ...(archived && { take: ARCHIVED_MAX }),
    });
    return rows.map(toTask);
  }

  async archive(householdId: string, id: string, userId: string): Promise<Task> {
    const task = await this.find(householdId, id, userId);
    if (task.status !== 'hecho') throw new BadRequestException('Solo se archivan las tareas hechas');
    const row = await this.prisma.task.update({ where: { id }, data: { archivedAt: task.archivedAt ?? new Date() }, include });
    return toTask(row);
  }

  async unarchive(householdId: string, id: string, userId: string): Promise<Task> {
    await this.find(householdId, id, userId);
    const row = await this.prisma.task.update({ where: { id }, data: { archivedAt: null, status: 'hecho', doneAt: new Date() }, include });
    return toTask(row);
  }

  /** Archiva las hechas de un tablero: el del hogar o tus personales. */
  async archiveDone(householdId: string, userId: string, body: unknown): Promise<{ archived: number }> {
    const personal = asObject(body ?? {})['personal'] === true;
    const { count } = await this.prisma.task.updateMany({
      where: { householdId, status: 'hecho', archivedAt: null, personal, ...(personal && { createdById: userId }) },
      data: { archivedAt: new Date() },
    });
    return { archived: count };
  }

  /** @param db cliente de Prisma o una transacción en curso (al aceptar una idea). */
  async create(
    householdId: string,
    createdById: string,
    body: unknown,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<Task> {
    const { assigneeIds, personal, ...input } = await this.validate(householdId, body, false);
    // Una tarea personal es siempre de quien la crea.
    const people = personal ? [createdById] : (assigneeIds ?? []);
    const row = await db.task.create({
      data: {
        householdId,
        createdById,
        title: input.title!,
        notes: input.notes ?? '',
        status: input.status ?? 'por_hacer',
        priority: input.priority!,
        due: input.due ?? null,
        category: input.category ?? null,
        personal: !!personal,
        doneAt: input.status === 'hecho' ? new Date() : null,
        assignees: { create: people.map((userId) => ({ userId })) },
      },
      include,
    });
    const task = toTask(row);
    // Dentro de una transacción aún podría deshacerse: entonces no se avisa.
    if (db === this.prisma) void this.notifyAssigned(householdId, task, [], createdById);
    return task;
  }

  /** Cambia solo los campos enviados (sirve también para mover de columna). */
  async update(householdId: string, id: string, actorId: string, body: unknown): Promise<Task> {
    const current = await this.find(householdId, id, actorId);
    // En las personales no se cambia ni la persona ni el tipo.
    const { assigneeIds: requested, personal: _personal, ...patch } = await this.validate(householdId, body, true);
    const assigneeIds = current.personal ? undefined : requested;
    // Al pasar a Hecho empieza a contar la semana; al salir de Hecho deja de estar hecha (y archivada).
    const done =
      patch.status === undefined || (patch.status === 'hecho') === (current.status === 'hecho')
        ? {}
        : patch.status === 'hecho'
          ? { doneAt: new Date() }
          : { doneAt: null, archivedAt: null };
    const before = assigneeIds ? await this.prisma.taskAssignee.findMany({ where: { taskId: id } }) : [];
    const assignees = assigneeIds && { deleteMany: {}, create: assigneeIds.map((userId) => ({ userId })) };
    const row = await this.prisma.task.update({ where: { id }, data: { ...patch, ...done, assignees }, include });
    const task = toTask(row);
    if (assigneeIds) void this.notifyAssigned(householdId, task, before.map((a) => a.userId), actorId);
    return task;
  }

  async remove(householdId: string, id: string, userId: string): Promise<void> {
    await this.find(householdId, id, userId);
    await this.prisma.task.delete({ where: { id } });
  }

  /** Avisa a quien acaba de entrar en la tarea, salvo a quien la ha asignado (ya lo sabe). */
  private async notifyAssigned(householdId: string, task: Task, before: string[], actorId: string) {
    const added = task.assigneeIds.filter((id) => !before.includes(id) && id !== actorId);
    if (!added.length) return;
    try {
      const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { name: true } });
      await this.push.send(added, {
        title: `${actor?.name ?? 'Alguien'} te ha asignado una tarea`,
        body: task.title,
        url: `/tareas?casa=${householdId}`,
        tag: `asignada-${task.id}`,
      });
    } catch (err) {
      this.logger.warn(`No se pudo avisar de la tarea asignada: ${(err as Error).message}`);
    }
  }

  /** Las personales de otra persona se responden como si no existieran. */
  private async find(householdId: string, id: string, userId: string) {
    const task = await this.prisma.task.findFirst({ where: { id, householdId, ...visibleTo(userId) } });
    if (!task) throw new NotFoundException('La tarea no existe');
    return task;
  }

  private async validate(householdId: string, body: unknown, partial: boolean): Promise<Partial<TaskInput>> {
    const b = asObject(body);
    const out: Partial<TaskInput> = {};
    const has = (key: string) => b[key] !== undefined || !partial;

    if (has('title')) out.title = requiredText(b['title'], 'El título', 120);
    if (b['notes'] !== undefined) {
      const notes = typeof b['notes'] === 'string' ? b['notes'].trim() : '';
      if (notes.length > NOTES_MAX) throw new BadRequestException(`Las notas no pueden pasar de ${NOTES_MAX} caracteres`);
      out.notes = notes;
    }
    if (b['status'] !== undefined) out.status = oneOf(b['status'], TASK_STATUSES, 'Estado');
    if (has('priority')) out.priority = oneOf(b['priority'], PRIORITIES, 'Prioridad');
    if (b['due'] !== undefined) {
      const due = b['due'] === null || b['due'] === '' ? null : b['due'];
      if (due !== null && (typeof due !== 'string' || !ISO_DATE_RE.test(due))) {
        throw new BadRequestException('Fecha no válida (AAAA-MM-DD)');
      }
      out.due = due;
    }
    if (b['category'] !== undefined) {
      const category = typeof b['category'] === 'string' ? b['category'].trim() : '';
      if (category.length > CATEGORY_MAX) throw new BadRequestException(`La categoría no puede pasar de ${CATEGORY_MAX} caracteres`);
      out.category = category || null;
    }
    if (b['personal'] !== undefined) {
      if (typeof b['personal'] !== 'boolean') throw new BadRequestException('«Personal» tiene que ser sí o no');
      out.personal = b['personal'];
    }
    if (b['assigneeIds'] !== undefined) out.assigneeIds = await parseAssigneeIds(this.prisma, householdId, b['assigneeIds']);
    return out;
  }
}
