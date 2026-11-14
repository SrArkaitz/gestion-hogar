import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { addDays, ageOn, BILL_NOTICE_DAYS, formatEuros, IsoDate, nextBirthday, isBirthdayOn } from '@hogar/shared';
import { minutesNow, TIME_ZONE, todayIso } from '../common/dates';
import { householdUses } from '../households/section.guard';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

interface Digest {
  householdId: string;
  householdName: string;
  /** Lleva alguna del hogar (si no, son todas personales y el aviso abre esa pestaña). */
  house: boolean;
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
      const calendar = await this.sendCalendarReminders(today);
      const maintenance = await this.sendMaintenanceReminders(today);
      if (tasks || bills || calendar || maintenance) {
        this.logger.log(`Recordatorios enviados: ${tasks} de tareas, ${bills} de facturas, ${calendar} del calendario y ${maintenance} de mantenimiento`);
      }
    } catch (err) {
      this.logger.error(`No se pudieron enviar los recordatorios: ${(err as Error).message}`);
    }
  }

  /** Cada 5 minutos: los eventos con hora avisan una hora antes. */
  @Cron('0 */5 * * * *', { timeZone: TIME_ZONE })
  async everyFiveMinutes(): Promise<void> {
    try {
      const sent = await this.sendSoonEventReminders();
      if (sent) this.logger.log(`Avisos de eventos en una hora: ${sent}`);
    } catch (err) {
      this.logger.error(`No se pudieron avisar los eventos: ${(err as Error).message}`);
    }
  }

  /**
   * Eventos con hora que empiezan dentro de la próxima hora (también los de poco después de
   * medianoche, del día siguiente). Cada uno se avisa una vez por día y hora: a sus personas o, si
   * no tiene, a toda la casa. Los que se crean con menos de una hora de margen avisan en la
   * siguiente vuelta.
   * @returns cuántos dispositivos han recibido algún aviso.
   */
  async sendSoonEventReminders(now = new Date()): Promise<number> {
    const today = todayIso(now), tomorrow = addDays(today, 1), nowMin = minutesNow(now);
    const events = await this.prisma.calendarEvent.findMany({
      where: { date: { in: [today, tomorrow] }, time: { not: null }, household: householdUses('calendario') },
      include: { people: { select: { userId: true } }, household: { select: { name: true, members: { select: { userId: true } } } } },
    });
    let sent = 0;
    for (const e of events) {
      const [h, m] = e.time!.split(':').map(Number);
      const left = h * 60 + m + (e.date === tomorrow ? 1440 : 0) - nowMin;
      const key = `${e.date} ${e.time}`;
      if (left <= 0 || left > 60 || e.remindedFor === key) continue;
      // Se marca antes de mandar: si dos vueltas coinciden, solo avisa una.
      const { count } = await this.prisma.calendarEvent.updateMany({
        where: { id: e.id, OR: [{ remindedFor: null }, { remindedFor: { not: key } }] },
        data: { remindedFor: key },
      });
      if (!count) continue;
      const to = e.people.length ? e.people.map((p) => p.userId) : e.household.members.map((x) => x.userId);
      sent += await this.push.send(
        to,
        {
          title: `${left >= 55 ? 'Dentro de una hora' : `Dentro de ${left} min`} · ${e.household.name}`,
          body: `${e.title} a las ${e.time}.`,
          url: `/calendario?casa=${e.householdId}`,
          tag: `evento-${e.id}`,
        },
        'calendario',
      );
    }
    return sent;
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
        'facturas',
      );
    }
    return sent;
  }

  /**
   * Calendario: los eventos sin hora que empiezan hoy (los que tienen hora avisan una hora antes)
   * y los cumpleaños de hoy. Un aviso por persona y casa (si la casa usa el calendario): los
   * eventos con personas, solo a ellas; los demás y los cumpleaños, a toda la casa.
   * @returns cuántos dispositivos han recibido algún aviso.
   */
  async sendCalendarReminders(today: IsoDate): Promise<number> {
    const households = await this.prisma.household.findMany({
      where: householdUses('calendario'),
      select: {
        id: true,
        name: true,
        members: { select: { userId: true, user: { select: { name: true, birthMonth: true, birthDay: true } } } },
        events: { where: { date: today, time: null }, orderBy: { title: 'asc' }, include: { people: { select: { userId: true } } } },
        birthdays: true,
      },
    });
    let sent = 0;
    for (const h of households) {
      const birthdays: string[] = [];
      const written = new Set<string>();
      for (const b of h.birthdays) {
        const next = nextBirthday(b, today);
        const days = Math.round((Date.parse(next) - Date.parse(today)) / 86_400_000);
        const age = ageOn(b, next);
        const turns = age !== null ? `, cumple ${age}` : '';
        // Todos se avisan el mismo día del cumpleaños, sin antelación.
        if (days === 0) {
          birthdays.push(`¡Hoy es el cumpleaños de ${b.name}${turns}!`);
          written.add(b.name.trim().toLowerCase());
        }
      }
      // Los de la gente de la casa que lo ha puesto en su cuenta (salvo que ya esté apuntado igual a mano).
      const members = h.members.filter(({ user }) =>
        isBirthdayOn(user.birthMonth && user.birthDay ? { month: user.birthMonth, day: user.birthDay } : null, today)
        && !written.has(user.name.trim().toLowerCase()));
      for (const { userId } of h.members) {
        const mine = h.events.filter((e) => !e.people.length || e.people.some((p) => p.userId === userId));
        const theirs = members.map((m) => m.userId === userId
          ? `¡Feliz cumpleaños, ${m.user.name.split(' ')[0]}!`
          : `¡Hoy es el cumpleaños de ${m.user.name}!`);
        const parts = [...(mine.length ? [`Hoy: ${mine.map((e) => e.title).join(', ')}.`] : []), ...birthdays, ...theirs];
        if (!parts.length) continue;
        sent += await this.push.send(
          [userId],
          { title: `Hoy en el calendario · ${h.name}`, body: parts.join(' '), url: `/calendario?casa=${h.id}`, tag: `calendario-${h.id}` },
          'calendario',
        );
      }
    }
    return sent;
  }

  /**
   * Revisiones: se avisa el día que toca según su antelación, el mismo día y, si ya vencieron,
   * una vez por semana (no todos los días). Un aviso por casa a todos sus miembros.
   * @returns cuántos dispositivos han recibido algún aviso.
   */
  async sendMaintenanceReminders(today: IsoDate): Promise<number> {
    const rows = await this.prisma.maintenance.findMany({
      where: { nextDue: { not: null }, household: householdUses('mantenimiento') },
      orderBy: { nextDue: 'asc' },
      include: { household: { select: { id: true, name: true, members: { select: { userId: true } } } } },
    });
    const byHousehold = new Map<string, typeof rows>();
    for (const m of rows) {
      const days = Math.round((Date.parse(m.nextDue!) - Date.parse(today)) / 86_400_000);
      const due = days === m.notifyDays || days === 0 || (days < 0 && days % 7 === 0);
      if (due) byHousehold.set(m.householdId, [...(byHousehold.get(m.householdId) ?? []), m]);
    }
    let sent = 0;
    for (const [householdId, list] of byHousehold) {
      const { name, members } = list[0].household;
      sent += await this.push.send(
        members.map((m) => m.userId),
        {
          title: `${list.length === 1 ? 'Revisión pendiente' : `${list.length} revisiones pendientes`} · ${name}`,
          body: list.map((m) => `${m.name} ${dueText(m.nextDue!, today)}`).join('. ') + '.',
          url: `/mantenimiento?casa=${householdId}`,
          tag: `mantenimiento-${householdId}`,
        },
        'mantenimiento',
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
      // Las personales, solo a su dueño; las del hogar sin nadie asignado, a toda la casa.
      const people = task.personal || task.assignees.length ? task.assignees : task.household.members;
      for (const { userId } of people) {
        const key = `${userId}|${task.householdId}`;
        let digest = digests.get(key);
        if (!digest) {
          digest = { householdId: task.householdId, householdName: task.household.name, house: false, today: [], late: [] };
          digests.set(key, digest);
        }
        if (!task.personal) digest.house = true;
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
        url: `${d.house ? '/tareas/hogar' : '/tareas'}?casa=${d.householdId}`,
        tag: `recordatorio-${d.householdId}`,
      }, 'tareas');
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
