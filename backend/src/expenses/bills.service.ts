import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  addMonths,
  Bill,
  BILL_INTERVAL_MAX,
  EXPENSE_CONCEPT_MAX,
  EXPENSE_NOTES_MAX,
  Expense,
  tidyName,
} from '@hogar/shared';
import { asObject, optionalText, requiredText } from '../common/validation';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { cents, date, ExpensesService } from './expenses.service';

const toBill = (r: Prisma.BillGetPayload<object>): Bill => ({
  id: r.id,
  name: r.name,
  amount: r.amount,
  interval: r.interval,
  nextDue: r.nextDue,
  active: r.active,
  notes: r.notes,
});

/** Categoría con la que se apuntan los gastos que salen de pagar una factura. */
const BILL_CATEGORY = 'Facturas';

/** Facturas fijas: al pagar una se crea su gasto y pasa a su siguiente vencimiento. */
@Injectable()
export class BillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expenses: ExpensesService,
  ) {}

  async list(householdId: string): Promise<Bill[]> {
    const rows = await this.prisma.bill.findMany({ where: { householdId }, orderBy: [{ active: 'desc' }, { nextDue: 'asc' }] });
    return rows.map(toBill);
  }

  async create(householdId: string, body: unknown): Promise<Bill> {
    const d = this.validate(body, false);
    const row = await this.prisma.bill.create({
      data: { householdId, name: d.name!, amount: d.amount ?? null, interval: d.interval!, nextDue: d.nextDue!, active: d.active ?? true, notes: d.notes ?? '' },
    });
    return toBill(row);
  }

  async update(householdId: string, id: string, body: unknown): Promise<Bill> {
    await this.find(householdId, id);
    const row = await this.prisma.bill.update({ where: { id }, data: this.validate(body, true) });
    return toBill(row);
  }

  /** Borra la factura; los gastos que se pagaron con ella se quedan. */
  async remove(householdId: string, id: string): Promise<void> {
    await this.find(householdId, id);
    await this.prisma.bill.delete({ where: { id } });
  }

  /** Apunta el pago como gasto y pasa la factura a su siguiente vencimiento. */
  async pay(householdId: string, userId: string, id: string, body: unknown): Promise<{ bill: Bill; expense: Expense }> {
    const bill = await this.find(householdId, id);
    const data = await this.expenses.validate(householdId, { ...asObject(body), concept: bill.name, category: BILL_CATEGORY });
    return this.prisma.$transaction(async (tx) => {
      // Solo avanza si nadie la ha pagado entre medias (dos personas pulsando a la vez).
      const next = addMonths(bill.nextDue, bill.interval);
      const moved = await tx.bill.updateMany({ where: { id, nextDue: bill.nextDue }, data: { nextDue: next } });
      if (!moved.count) throw new BadRequestException('Esa factura ya se acaba de pagar');
      const expense = await this.expenses.insert(tx, householdId, userId, data, id);
      return { bill: toBill({ ...bill, nextDue: next }), expense };
    });
  }

  private async find(householdId: string, id: string) {
    const row = await this.prisma.bill.findFirst({ where: { id, householdId } });
    if (!row) throw new NotFoundException('Esa factura no existe');
    return row;
  }

  private validate(body: unknown, partial: boolean) {
    const b = asObject(body);
    const has = (key: string) => b[key] !== undefined || !partial;
    const out: { name?: string; amount?: number | null; interval?: number; nextDue?: string; active?: boolean; notes?: string } = {};
    if (has('name')) out.name = tidyName(requiredText(b['name'], 'El nombre', EXPENSE_CONCEPT_MAX));
    if (b['amount'] !== undefined) out.amount = b['amount'] === null ? null : cents(b['amount']);
    if (has('interval')) {
      const n = b['interval'];
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > BILL_INTERVAL_MAX) {
        throw new BadRequestException(`Cada cuántos meses: un número entre 1 y ${BILL_INTERVAL_MAX}`);
      }
      out.interval = n;
    }
    if (has('nextDue')) out.nextDue = date(b['nextDue'], 'Fecha de vencimiento');
    if (b['active'] !== undefined) {
      if (typeof b['active'] !== 'boolean') throw new BadRequestException('active tiene que ser true o false');
      out.active = b['active'];
    }
    if (b['notes'] !== undefined) out.notes = optionalText(b['notes'], 'Las notas', EXPENSE_NOTES_MAX) ?? '';
    return out;
  }
}
