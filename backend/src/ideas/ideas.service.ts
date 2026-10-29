import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AcceptIdeaResult, Idea, IdeaInput, IdeaStatus, IDEA_STATUSES, PRIORITIES, Role } from '@hogar/shared';
import { asObject, oneOf, requiredText } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';

const DESCRIPTION_MAX = 2000;
const CATEGORY_MAX = 40;
/** Estados que se pueden poner a mano; "aceptada" solo al aceptarla. */
const EDITABLE_STATUSES = IDEA_STATUSES.filter((s) => s !== 'aceptada') as Exclude<IdeaStatus, 'aceptada'>[];

interface Row {
  id: string;
  title: string;
  description: string;
  status: string;
  category: string | null;
  proposedById: string;
  taskId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const toIdea = (r: Row): Idea => ({
  id: r.id,
  title: r.title,
  description: r.description,
  status: r.status as IdeaStatus,
  category: r.category,
  proposedById: r.proposedById,
  taskId: r.taskId,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

/** Ideas de una casa. El HouseholdGuard ya ha comprobado que el usuario es miembro. */
@Injectable()
export class IdeasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
  ) {}

  async list(householdId: string): Promise<Idea[]> {
    const rows = await this.prisma.idea.findMany({ where: { householdId }, orderBy: { createdAt: 'desc' } });
    return rows.map(toIdea);
  }

  async create(householdId: string, proposedById: string, body: unknown): Promise<Idea> {
    const input = this.validate(body, false);
    const row = await this.prisma.idea.create({
      data: {
        householdId,
        proposedById,
        title: input.title!,
        description: input.description ?? '',
        category: input.category ?? null,
        status: input.status ?? 'nueva',
      },
    });
    return toIdea(row);
  }

  async update(householdId: string, id: string, body: unknown): Promise<Idea> {
    const idea = await this.find(householdId, id);
    const patch = this.validate(body, true);
    if (patch.status && idea.status === 'aceptada') {
      throw new BadRequestException('La idea ya está aceptada y tiene su tarea');
    }
    return toIdea(await this.prisma.idea.update({ where: { id }, data: patch }));
  }

  /** Solo quien la propuso o un administrador. Lo normal es descartarla, que la deja archivada. */
  async remove(householdId: string, id: string, actor: { id: string; role: Role }): Promise<void> {
    const idea = await this.find(householdId, id);
    if (idea.proposedById !== actor.id && actor.role !== 'admin') {
      throw new ForbiddenException('Solo quien propuso la idea o un administrador pueden borrarla');
    }
    await this.prisma.idea.delete({ where: { id } });
  }

  /** Crea la tarea con el título, la descripción y la categoría de la idea, y las enlaza. */
  async accept(householdId: string, id: string, userId: string, body: unknown): Promise<AcceptIdeaResult> {
    const idea = await this.find(householdId, id);
    if (idea.status === 'aceptada') throw new BadRequestException('La idea ya está aceptada');
    const priority = oneOf(asObject(body)['priority'], PRIORITIES, 'Prioridad');

    return this.prisma.$transaction(async (tx) => {
      // Se marca primero para que dos aceptaciones a la vez no creen dos tareas.
      const marked = await tx.idea.updateMany({ where: { id, status: { not: 'aceptada' } }, data: { status: 'aceptada' } });
      if (marked.count === 0) throw new BadRequestException('La idea ya está aceptada');
      const task = await this.tasks.create(
        householdId,
        userId,
        { title: idea.title, notes: idea.description, category: idea.category, priority },
        tx,
      );
      const updated = await tx.idea.update({ where: { id }, data: { taskId: task.id } });
      return { idea: toIdea(updated), task: { ...task, ideaId: id } };
    });
  }

  private async find(householdId: string, id: string) {
    const idea = await this.prisma.idea.findFirst({ where: { id, householdId } });
    if (!idea) throw new NotFoundException('La idea no existe');
    return idea;
  }

  private validate(body: unknown, partial: boolean): Partial<IdeaInput> {
    const b = asObject(body);
    const out: Partial<IdeaInput> = {};
    if (b['title'] !== undefined || !partial) out.title = requiredText(b['title'], 'El título', 120);
    if (b['description'] !== undefined) {
      const description = typeof b['description'] === 'string' ? b['description'].trim() : '';
      if (description.length > DESCRIPTION_MAX) {
        throw new BadRequestException(`La descripción no puede pasar de ${DESCRIPTION_MAX} caracteres`);
      }
      out.description = description;
    }
    if (b['category'] !== undefined) {
      const category = typeof b['category'] === 'string' ? b['category'].trim() : '';
      if (category.length > CATEGORY_MAX) throw new BadRequestException(`La categoría no puede pasar de ${CATEGORY_MAX} caracteres`);
      out.category = category || null;
    }
    if (b['status'] !== undefined) out.status = oneOf(b['status'], EDITABLE_STATUSES, 'Estado');
    return out;
  }
}
