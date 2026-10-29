import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ISO_DATE_RE, PRIORITIES, Priority, Task, TASK_STATUSES, TaskInput, TaskStatus } from '@hogar/shared';
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
  assigneeIds: r.assignees.map((a) => a.userId),
  createdById: r.createdById,
  ideaId: r.idea?.id ?? null,
  recurringId: r.recurringId,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

/** Tareas de una casa. El HouseholdGuard ya ha comprobado que el usuario es miembro. */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  async list(householdId: string): Promise<Task[]> {
    const rows = await this.prisma.task.findMany({ where: { householdId }, include, orderBy: { createdAt: 'asc' } });
    return rows.map(toTask);
  }

  /** @param db cliente de Prisma o una transacción en curso (al aceptar una idea). */
  async create(
    householdId: string,
    createdById: string,
    body: unknown,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<Task> {
    const { assigneeIds, ...input } = await this.validate(householdId, body, false);
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
        assignees: { create: (assigneeIds ?? []).map((userId) => ({ userId })) },
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
    await this.find(householdId, id);
    const { assigneeIds, ...patch } = await this.validate(householdId, body, true);
    const before = assigneeIds ? await this.prisma.taskAssignee.findMany({ where: { taskId: id } }) : [];
    const assignees = assigneeIds && { deleteMany: {}, create: assigneeIds.map((userId) => ({ userId })) };
    const row = await this.prisma.task.update({ where: { id }, data: { ...patch, assignees }, include });
    const task = toTask(row);
    if (assigneeIds) void this.notifyAssigned(householdId, task, before.map((a) => a.userId), actorId);
    return task;
  }

  async remove(householdId: string, id: string): Promise<void> {
    await this.find(householdId, id);
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

  private async find(householdId: string, id: string) {
    const task = await this.prisma.task.findFirst({ where: { id, householdId } });
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
    if (b['assigneeIds'] !== undefined) out.assigneeIds = await parseAssigneeIds(this.prisma, householdId, b['assigneeIds']);
    return out;
  }
}
