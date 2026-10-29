import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { addDays, BILL_NOTICE_DAYS, formatEuros, IsoDate } from '@hogar/shared';
import { TIME_ZONE, todayIso } from '../common/dates';
import { householdUses } from '../households/section.guard';
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
      const today = todayIso();
      const tasks = await this.sendDueReminders(today);
      const bills = await this.sendBillReminders(today);
      if (tasks || bills) this.logger.log(`Recordatorios enviados: ${tasks} de tareas y ${bills} de facturas`);
    } catch (err) {
      this.logger.error(`No se pudieron enviar los recordatorios: ${(err as Error).message}`);
    }
  }

  /**
   * Facturas que vencen en los próximos días o ya vencieron: un aviso por casa a todos sus
   * miembros. Las casas que ocultan Gastos no reciben nada.
   * @returns cuántos dispositivos han recibido algún aviso.
   */
  async sendBillReminders(today: IsoDate): Promise<number> {
    const bills = await this.prisma.bill.findMany({
      where: { active: true, nextDue: { lte: addDays(today, BILL_NOTICE_DAYS) }, household: householdUses('gastos') },
      orderBy: { nextDue: 'asc' },
      include: { household: { select: { id: true, name: true, members: { select: { userId: true } } } } },
    });
    const byHousehold = new Map<string, typeof bills>();
    for (const bill of bills) byHousehold.set(bill.householdId, [...(byHousehold.get(bill.householdId) ?? []), bill]);

    let sent = 0;
    for (const [householdId, list] of byHousehold) {
      const { name, members } = list[0].household;
      const lines = list.map((b) => `${b.name} ${dueText(b.nextDue, today)}${b.amount ? ` (unos ${formatEuros(b.amount)})` : ''}`);
      sent += await this.push.send(
        members.map((m) => m.userId),
        {
          title: `${list.length === 1 ? 'Factura por pagar' : `${list.length} facturas por pagar`} · ${name}`,
          body: lines.join('. ') + '.',
          url: `/gastos/facturas?casa=${householdId}`,
          tag: `facturas-${householdId}`,
        },
      );
    }
    return sent;
  }

  /** @returns cuántos dispositivos han recibido algún aviso. */
  async sendDueReminders(today: IsoDate): Promise<number> {
    const tasks = await this.prisma.task.findMany({
      where: { status: { not: 'hecho' }, due: { lte: today }, household: householdUses('tareas') },
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

/** "vence hoy", "vence mañana", "vence el 5 nov" o "venció el 2 nov". */
function dueText(due: IsoDate, today: IsoDate): string {
  if (due === today) return 'vence hoy';
  if (due === addDays(today, 1)) return 'vence mañana';
  const day = new Date(due + 'T00:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return due < today ? `venció el ${day}` : `vence el ${day}`;
}

/** "A, B y C", o "A, B, C y 2 más" si son muchas. */
function list(titles: string[]): string {
  const shown = titles.slice(0, 3);
  const rest = titles.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} y ${rest} más`;
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} y ${shown.at(-1)}` : shown[0];
}
