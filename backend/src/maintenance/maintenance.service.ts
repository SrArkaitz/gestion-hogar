import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  addMonths,
  Maintenance,
  MAINTENANCE_INTERVAL_MAX,
  MAINTENANCE_NAME_MAX,
  MAINTENANCE_NOTES_MAX,
  MAINTENANCE_NOTICE_MAX,
  MaintenanceLog,
  tidyName,
} from '@hogar/shared';
import { asObject, optionalText, requiredText } from '../common/validation';
import { cents, date } from '../expenses/expenses.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const include = { logs: { orderBy: { date: 'desc' }, take: 1, select: { date: true } } } as const;
type Row = Prisma.MaintenanceGetPayload<{ include: typeof include }>;

const toMaintenance = (r: Row): Maintenance => ({
  id: r.id,
  name: r.name,
  group: r.group,
  interval: r.interval,
  nextDue: r.nextDue,
  notifyDays: r.notifyDays,
  notes: r.notes,
  lastDone: r.logs[0]?.date ?? null,
});

const toLog = (r: Prisma.MaintenanceLogGetPayload<object>): MaintenanceLog => ({
  id: r.id,
  date: r.date,
  notes: r.notes,
  cost: r.cost,
});

/**
 * Revisiones periódicas (ITV, caldera, filtros…). Al marcar una como hecha se apunta en su
 * historial y la próxima fecha se cuenta desde ese día.
 */
@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(householdId: string): Promise<Maintenance[]> {
    const rows = await this.prisma.maintenance.findMany({ where: { householdId }, include });
    // Primero lo que tiene fecha (la más cercana antes); al final lo que no tiene.
    return rows.map(toMaintenance).sort((a, b) => (a.nextDue ?? '9999').localeCompare(b.nextDue ?? '9999') || a.name.localeCompare(b.name, 'es'));
  }

  async create(householdId: string, body: unknown): Promise<Maintenance> {
    const row = await this.prisma.maintenance.create({ data: { householdId, ...validate(body) }, include });
    return toMaintenance(row);
  }

  async update(householdId: string, id: string, body: unknown): Promise<Maintenance> {
    await this.find(householdId, id);
    return toMaintenance(await this.prisma.maintenance.update({ where: { id }, data: validate(body), include }));
  }

  async remove(householdId: string, id: string): Promise<void> {
    await this.find(householdId, id);
    await this.prisma.maintenance.delete({ where: { id } });
  }

  /** Apunta que se ha hecho y calcula la próxima fecha (si se repite). */
  async done(householdId: string, userId: string, id: string, body: unknown): Promise<Maintenance> {
    const row = await this.find(householdId, id);
    const b = asObject(body);
    const when = date(b['date'], 'Fecha');
    const cost = b['cost'] === undefined || b['cost'] === null ? null : cents(b['cost']);
    const notes = optionalText(b['notes'], 'Las notas', MAINTENANCE_NOTES_MAX) ?? '';
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.maintenanceLog.create({ data: { maintenanceId: id, date: when, notes, cost, createdById: userId } });
      return tx.maintenance.update({
        where: { id },
        data: { nextDue: row.interval ? addMonths(when, row.interval) : null },
        include,
      });
    });
    return toMaintenance(updated);
  }

  async logs(householdId: string, id: string): Promise<MaintenanceLog[]> {
    await this.find(householdId, id);
    const rows = await this.prisma.maintenanceLog.findMany({ where: { maintenanceId: id }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] });
    return rows.map(toLog);
  }

  async removeLog(householdId: string, id: string, logId: string): Promise<void> {
    await this.find(householdId, id);
    const { count } = await this.prisma.maintenanceLog.deleteMany({ where: { id: logId, maintenanceId: id } });
    if (!count) throw new NotFoundException('Esa entrada del historial no existe');
  }

  private async find(householdId: string, id: string) {
    const row = await this.prisma.maintenance.findFirst({ where: { id, householdId } });
    if (!row) throw new NotFoundException('Esa revisión no existe');
    return row;
  }
}

function validate(body: unknown) {
  const b = asObject(body);
  const interval = b['interval'] === undefined || b['interval'] === null ? null : int(b['interval'], 'Cada cuántos meses', 1, MAINTENANCE_INTERVAL_MAX);
  const group = optionalText(b['group'], 'El grupo', 40);
  return {
    name: tidyName(requiredText(b['name'], 'El nombre', MAINTENANCE_NAME_MAX)),
    group: group ? tidyName(group) : null,
    interval,
    nextDue: b['nextDue'] === undefined || b['nextDue'] === null || b['nextDue'] === '' ? null : date(b['nextDue'], 'Próxima fecha'),
    notifyDays: b['notifyDays'] === undefined ? 7 : int(b['notifyDays'], 'Los días de aviso', 0, MAINTENANCE_NOTICE_MAX),
    notes: optionalText(b['notes'], 'Las notas', MAINTENANCE_NOTES_MAX) ?? '',
  };
}

function int(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException(`${label}: un número entre ${min} y ${max}`);
  }
  return value;
}
