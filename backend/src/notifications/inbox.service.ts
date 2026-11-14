import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppNotification, NOTIFICATION_KEEP_DAYS, NOTIFICATION_LIST_MAX, NotificationList, PushPayload } from '@hogar/shared';
import { TIME_ZONE } from '../common/dates';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const toNotification = (r: Prisma.UserNotificationGetPayload<object>): AppNotification => ({
  id: r.id,
  title: r.title,
  body: r.body,
  url: r.url,
  read: !!r.readAt,
  createdAt: r.createdAt.toISOString(),
});

/**
 * Avisos de la campanita. PushService guarda aquí cada aviso que manda, así que se ven también
 * en los dispositivos sin push. Se guardan NOTIFICATION_KEEP_DAYS días.
 */
@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** No lanza errores: guardar el aviso no debe impedir mandarlo. */
  async add(userIds: string[], payload: PushPayload): Promise<void> {
    try {
      await this.prisma.userNotification.createMany({
        data: [...new Set(userIds)].map((userId) => ({ userId, title: payload.title, body: payload.body, url: payload.url })),
      });
    } catch (err) {
      this.logger.warn(`No se pudo guardar el aviso: ${(err as Error).message}`);
    }
  }

  async list(userId: string): Promise<NotificationList> {
    const [rows, unread] = await Promise.all([
      this.prisma.userNotification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: NOTIFICATION_LIST_MAX }),
      this.prisma.userNotification.count({ where: { userId, readAt: null } }),
    ]);
    return { items: rows.map(toNotification), unread };
  }

  async markRead(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.userNotification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    if (!count && !(await this.prisma.userNotification.count({ where: { id, userId } }))) throw new NotFoundException('Ese aviso no existe');
  }

  /** Quita un aviso tuyo de la campanita. */
  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.userNotification.deleteMany({ where: { id, userId } });
    if (!count) throw new NotFoundException('Ese aviso no existe');
  }

  /** Quita todos tus avisos ya leídos. Devuelve cuántos. */
  async removeRead(userId: string): Promise<number> {
    const { count } = await this.prisma.userNotification.deleteMany({ where: { userId, readAt: { not: null } } });
    return count;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.userNotification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }

  /** Cada noche se borran los de hace más de NOTIFICATION_KEEP_DAYS días. */
  @Cron('0 15 4 * * *', { timeZone: TIME_ZONE })
  async cleanup(now = new Date()): Promise<number> {
    const { count } = await this.prisma.userNotification.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - NOTIFICATION_KEEP_DAYS * 86_400_000) } },
    });
    return count;
  }
}
