import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IsoDate } from '@hogar/shared';
import { TIME_ZONE, todayIso } from '../common/dates';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

interface Digest {
  householdId: string;
  householdName: string;
  today: string[];
  late: string[];
}

/**
 * Recordatorio diario: a cada persona, un aviso por casa con las tareas sin hacer que vencen hoy
 * o ya han vencido. Las asignadas le llegan a quien las tiene; las sin asignar, a toda la casa.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  @Cron('0 0 9 * * *', { timeZone: TIME_ZONE })
  async daily(): Promise<void> {
    try {
      const sent = await this.sendDueReminders(todayIso());
      if (sent) this.logger.log(`Recordatorios de tareas enviados a ${sent} dispositivos`);
    } catch (err) {
      this.logger.error(`No se pudieron enviar los recordatorios: ${(err as Error).message}`);
    }
  }

  /** @returns cuántos dispositivos han recibido algún aviso. */
  async sendDueReminders(today: IsoDate): Promise<number> {
    const tasks = await this.prisma.task.findMany({
      where: { status: { not: 'hecho' }, due: { lte: today } },
      orderBy: [{ due: 'asc' }, { createdAt: 'asc' }],
      include: {
        assignees: { select: { userId: true } },
        household: { select: { id: true, name: true, members: { select: { userId: true } } } },
      },
    });

    // Un resumen por persona y casa.
    const digests = new Map<string, Digest>();
    for (const task of tasks) {
      const people = task.assignees.length ? task.assignees : task.household.members;
      for (const { userId } of people) {
        const key = `${userId}|${task.householdId}`;
        let digest = digests.get(key);
        if (!digest) {
          digest = { householdId: task.householdId, householdName: task.household.name, today: [], late: [] };
          digests.set(key, digest);
        }
        (task.due === today ? digest.today : digest.late).push(task.title);
      }
    }

    let sent = 0;
    for (const [key, d] of digests) {
      const userId = key.split('|')[0];
      const parts = [];
      if (d.today.length) parts.push(`Hoy: ${list(d.today)}.`);
      if (d.late.length) parts.push(`Vencidas: ${list(d.late)}.`);
      const total = d.today.length + d.late.length;
      sent += await this.push.send([userId], {
        title: `${total === 1 ? '1 tarea pendiente' : `${total} tareas pendientes`} · ${d.householdName}`,
        body: parts.join(' '),
        url: `/tareas?casa=${d.householdId}`,
        tag: `recordatorio-${d.householdId}`,
      });
    }
    return sent;
  }
}

/** "A, B y C", o "A, B, C y 2 más" si son muchas. */
function list(titles: string[]): string {
  const shown = titles.slice(0, 3);
  const rest = titles.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} y ${rest} más`;
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} y ${shown.at(-1)}` : shown[0];
}
