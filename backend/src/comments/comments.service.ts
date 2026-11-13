import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Comment, COMMENT_MAX, Role } from '@hogar/shared';
import { asObject } from '../common/validation';
import { PushService } from '../notifications/push.service';
import { PrismaService } from '../prisma/prisma.service';

/** De qué es el comentario: una tarea o una idea de una casa, vista por una persona. */
export interface CommentTarget {
  kind: 'task' | 'idea';
  householdId: string;
  id: string;
  userId: string;
}

/** Lo que hace falta de la tarea o la idea para avisar. */
interface Parent {
  title: string;
  /** Las personales no avisan a nadie: solo las ve quien las creó. */
  personal: boolean;
  /** Quién la creó o la propuso y, en las tareas, sus personas asignadas. */
  people: string[];
}

const include = { author: { select: { name: true } } } as const;

const toComment = (r: { id: string; authorId: string; text: string; createdAt: Date; author: { name: string } }): Comment => ({
  id: r.id,
  authorId: r.authorId,
  authorName: r.author.name,
  text: r.text,
  createdAt: r.createdAt.toISOString(),
});

/** Comentarios de las tarjetas de tareas e ideas. */
@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  /** Del más antiguo al más reciente, como una conversación. */
  async list(target: CommentTarget): Promise<Comment[]> {
    await this.parent(target);
    const rows = await this.prisma.comment.findMany({ where: this.where(target), include, orderBy: { createdAt: 'asc' } });
    return rows.map(toComment);
  }

  async add(target: CommentTarget, body: unknown): Promise<Comment> {
    const parent = await this.parent(target);
    const raw = asObject(body)['text'];
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) throw new BadRequestException('Escribe algo en el comentario');
    if (text.length > COMMENT_MAX) throw new BadRequestException(`El comentario no puede pasar de ${COMMENT_MAX} caracteres`);
    const row = await this.prisma.comment.create({
      data: { householdId: target.householdId, authorId: target.userId, text, ...this.where(target) },
      include,
    });
    const comment = toComment(row);
    if (!parent.personal) void this.notify(target, parent, comment);
    return comment;
  }

  /** Solo quien lo escribió o un administrador de la casa. */
  async remove(target: CommentTarget, commentId: string, role: Role): Promise<void> {
    await this.parent(target);
    const comment = await this.prisma.comment.findFirst({ where: { id: commentId, ...this.where(target) } });
    if (!comment) throw new NotFoundException('El comentario no existe');
    if (comment.authorId !== target.userId && role !== 'admin') {
      throw new ForbiddenException('Solo quien escribió el comentario o un administrador pueden borrarlo');
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
  }

  private where(target: CommentTarget) {
    return target.kind === 'task' ? { taskId: target.id } : { ideaId: target.id };
  }

  /** La tarea o la idea, si existe y la puede ver (las personales de otra persona no). */
  private async parent(target: CommentTarget): Promise<Parent> {
    const { householdId, id, userId } = target;
    if (target.kind === 'task') {
      const task = await this.prisma.task.findFirst({
        where: { id, householdId, OR: [{ personal: false }, { createdById: userId }] },
        select: { title: true, personal: true, createdById: true, assignees: { select: { userId: true } } },
      });
      if (!task) throw new NotFoundException('La tarea no existe');
      return { title: task.title, personal: task.personal, people: [task.createdById, ...task.assignees.map((a) => a.userId)] };
    }
    const idea = await this.prisma.idea.findFirst({ where: { id, householdId }, select: { title: true, proposedById: true } });
    if (!idea) throw new NotFoundException('La idea no existe');
    return { title: idea.title, personal: false, people: [idea.proposedById] };
  }

  /**
   * Avisa a quien está metido en la tarjeta: quien la creó o propuso, las personas asignadas y
   * quien ya ha comentado. Solo a los que siguen en la casa, y nunca a quien escribe.
   */
  private async notify(target: CommentTarget, parent: Parent, comment: Comment) {
    try {
      const earlier = await this.prisma.comment.findMany({ where: this.where(target), select: { authorId: true }, distinct: ['authorId'] });
      const involved = new Set([...parent.people, ...earlier.map((c) => c.authorId)]);
      involved.delete(target.userId);
      if (!involved.size) return;
      const members = await this.prisma.householdMember.findMany({
        where: { householdId: target.householdId, userId: { in: [...involved] } },
        select: { userId: true },
      });
      if (!members.length) return;
      const { householdId, id } = target;
      const text = comment.text.length > 140 ? comment.text.slice(0, 139) + '…' : comment.text;
      await this.push.send(
        members.map((m) => m.userId),
        {
          title: `${comment.authorName} ha comentado en «${parent.title}»`,
          body: text,
          url: target.kind === 'task' ? `/tareas/hogar?casa=${householdId}&tarea=${id}` : `/tareas/ideas?casa=${householdId}&idea=${id}`,
          tag: `comentario-${id}`,
        },
        'comentarios',
      );
    } catch (err) {
      this.logger.warn(`No se pudo avisar del comentario: ${(err as Error).message}`);
    }
  }
}
