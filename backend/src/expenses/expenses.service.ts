import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AMOUNT_MAX_CENTS,
  Balances,
  Cents,
  Expense,
  EXPENSE_CATEGORY_MAX,
  EXPENSE_CONCEPT_MAX,
  EXPENSE_NOTES_MAX,
  ExpenseInput,
  ISO_DATE_RE,
  IsoDate,
  Settlement,
  settleUp,
  splitEqually,
  tidyName,
} from '@hogar/shared';
import { parseMemberIds } from '../common/assignees';
import { asObject, optionalText, requiredText } from '../common/validation';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const include = { shares: { select: { userId: true, amount: true } } } as const;
type Row = Prisma.ExpenseGetPayload<{ include: typeof include }>;

const toExpense = (r: Row): Expense => ({
  id: r.id,
  concept: r.concept,
  amount: r.amount,
  date: r.date,
  category: r.category,
  notes: r.notes,
  paidById: r.paidById,
  shares: r.shares,
  billId: r.billId,
  createdAt: r.createdAt.toISOString(),
});

const toSettlement = (r: Prisma.SettlementGetPayload<object>): Settlement => ({
  id: r.id,
  fromId: r.fromId,
  toId: r.toId,
  amount: r.amount,
  date: r.date,
  createdAt: r.createdAt.toISOString(),
});

/** Días como mucho que se piden de una vez (un mes con margen). */
const RANGE_MAX_DAYS = 400;

/** Datos de un gasto ya comprobados, con el reparto calculado. */
export interface ExpenseData {
  concept: string;
  amount: Cents;
  date: IsoDate;
  category: string | null;
  notes: string;
  paidById: string;
  participantIds: string[];
}

/**
 * Gastos de la casa, pagos entre personas y saldos. Cada gasto se reparte a partes iguales entre
 * quienes se indique, y ese reparto se guarda tal cual (ExpenseShare).
 */
@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(householdId: string, from: unknown, to: unknown): Promise<Expense[]> {
    const range = dateRange(from, to);
    const rows = await this.prisma.expense.findMany({
      where: { householdId, date: { gte: range.from, lte: range.to } },
      include,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toExpense);
  }

  async create(householdId: string, userId: string, body: unknown): Promise<Expense> {
    const data = await this.validate(householdId, body);
    return this.insert(this.prisma, householdId, userId, data, null);
  }

  /** Crea el gasto (también desde una factura, dentro de su transacción). */
  async insert(db: Prisma.TransactionClient, householdId: string, userId: string, d: ExpenseData, billId: string | null) {
    const row = await db.expense.create({
      data: {
        householdId,
        createdById: userId,
        billId,
        concept: d.concept,
        amount: d.amount,
        date: d.date,
        category: d.category,
        notes: d.notes,
        paidById: d.paidById,
        shares: { create: splitEqually(d.amount, d.participantIds) },
      },
      include,
    });
    return toExpense(row);
  }

  /** Edita un gasto entero (el reparto se recalcula). */
  async update(householdId: string, id: string, body: unknown): Promise<Expense> {
    await this.find(householdId, id);
    const d = await this.validate(householdId, body);
    const row = await this.prisma.expense.update({
      where: { id },
      data: {
        concept: d.concept,
        amount: d.amount,
        date: d.date,
        category: d.category,
        notes: d.notes,
        paidById: d.paidById,
        shares: { deleteMany: {}, create: splitEqually(d.amount, d.participantIds) },
      },
      include,
    });
    return toExpense(row);
  }

  async remove(householdId: string, id: string): Promise<void> {
    await this.find(householdId, id);
    await this.prisma.expense.delete({ where: { id } });
  }

  async listSettlements(householdId: string, from: unknown, to: unknown): Promise<Settlement[]> {
    const range = dateRange(from, to);
    const rows = await this.prisma.settlement.findMany({
      where: { householdId, date: { gte: range.from, lte: range.to } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toSettlement);
  }

  async settle(householdId: string, userId: string, body: unknown): Promise<Settlement> {
    const b = asObject(body);
    const [fromId] = await parseMemberIds(this.prisma, householdId, [b['fromId']], 'fromId', 'Quien paga tiene que ser de la casa');
    const [toId] = await parseMemberIds(this.prisma, householdId, [b['toId']], 'toId', 'Quien cobra tiene que ser de la casa');
    if (fromId === toId) throw new BadRequestException('Quien paga y quien cobra tienen que ser personas distintas');
    const row = await this.prisma.settlement.create({
      data: { householdId, createdById: userId, fromId, toId, amount: cents(b['amount']), date: date(b['date']) },
    });
    return toSettlement(row);
  }

  async removeSettlement(householdId: string, id: string): Promise<void> {
    const row = await this.prisma.settlement.findFirst({ where: { id, householdId } });
    if (!row) throw new NotFoundException('Ese pago no existe');
    await this.prisma.settlement.delete({ where: { id } });
  }

  /**
   * Saldo de cada persona (lo que pagó − lo que le toca, contando los pagos entre personas) y
   * los pagos mínimos para quedar en paz. Incluye a quien ya no está en la casa si tiene saldo.
   */
  async balances(householdId: string): Promise<Balances> {
    const [paid, owed, sent, received, members] = await Promise.all([
      this.prisma.expense.groupBy({ by: ['paidById'], where: { householdId }, _sum: { amount: true } }),
      this.prisma.expenseShare.groupBy({ by: ['userId'], where: { expense: { householdId } }, _sum: { amount: true } }),
      this.prisma.settlement.groupBy({ by: ['fromId'], where: { householdId }, _sum: { amount: true } }),
      this.prisma.settlement.groupBy({ by: ['toId'], where: { householdId }, _sum: { amount: true } }),
      this.prisma.householdMember.findMany({ where: { householdId }, orderBy: { joinedAt: 'asc' }, select: { userId: true } }),
    ]);
    const totals = new Map<string, { paid: number; owed: number; settled: number }>();
    const get = (id: string) => totals.get(id) ?? totals.set(id, { paid: 0, owed: 0, settled: 0 }).get(id)!;
    for (const m of members) get(m.userId);
    for (const r of paid) get(r.paidById).paid += r._sum.amount ?? 0;
    for (const r of owed) get(r.userId).owed += r._sum.amount ?? 0;
    for (const r of sent) get(r.fromId).settled += r._sum.amount ?? 0;
    for (const r of received) get(r.toId).settled -= r._sum.amount ?? 0;

    const memberIds = new Set(members.map((m) => m.userId));
    const users = await this.prisma.user.findMany({ where: { id: { in: [...totals.keys()] } }, select: { id: true, name: true } });
    const names = new Map(users.map((u) => [u.id, u.name]));
    const balances = [...totals]
      .map(([userId, t]) => ({
        userId,
        name: names.get(userId) ?? '¿?',
        member: memberIds.has(userId),
        paid: t.paid,
        owed: t.owed,
        balance: t.paid - t.owed + t.settled,
      }))
      // Quien se fue sin cuentas pendientes ya no sale.
      .filter((b) => b.member || b.balance !== 0);
    return { balances, transfers: settleUp(balances) };
  }

  /** Comprueba los datos de un gasto (también los del pago de una factura). */
  async validate(householdId: string, body: unknown): Promise<ExpenseData> {
    const b = asObject(body);
    const [paidById] = await parseMemberIds(this.prisma, householdId, [b['paidById']], 'paidById', 'Quien paga tiene que ser de la casa');
    const participantIds = await parseMemberIds(
      this.prisma,
      householdId,
      b['participantIds'],
      'participantIds',
      'Solo se puede repartir entre miembros de la casa',
    );
    if (!participantIds.length) throw new BadRequestException('Elige entre quiénes se reparte');
    return {
      concept: tidyName(requiredText(b['concept'], 'El concepto', EXPENSE_CONCEPT_MAX)),
      amount: cents(b['amount']),
      date: date(b['date']),
      category: optionalText(b['category'], 'La categoría', EXPENSE_CATEGORY_MAX),
      notes: optionalText(b['notes'], 'Las notas', EXPENSE_NOTES_MAX) ?? '',
      paidById,
      participantIds,
    };
  }

  private async find(householdId: string, id: string) {
    const row = await this.prisma.expense.findFirst({ where: { id, householdId } });
    if (!row) throw new NotFoundException('Ese gasto no existe');
    return row;
  }
}

export function cents(value: unknown): Cents {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > AMOUNT_MAX_CENTS) {
    throw new BadRequestException('Importe no válido (en céntimos, mayor que cero)');
  }
  return value;
}

export function date(value: unknown, label = 'Fecha'): IsoDate {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new BadRequestException(`${label} no válida (AAAA-MM-DD)`);
  }
  return value;
}

function dateRange(from: unknown, to: unknown) {
  const range = { from: date(from, 'Fecha inicial'), to: date(to, 'Fecha final') };
  const days = (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000;
  if (days < 0 || days > RANGE_MAX_DAYS) throw new BadRequestException('Rango de fechas no válido');
  return range;
}
