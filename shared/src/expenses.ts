import { IsoDate } from './common';

/** Todos los importes van en céntimos (enteros) para no arrastrar errores de redondeo. */
export type Cents = number;

/** Categorías que se ofrecen; se puede escribir otra. */
export const EXPENSE_CATEGORIES = ['Supermercado', 'Casa', 'Facturas', 'Ocio', 'Restaurantes', 'Transporte', 'Salud', 'Otros'] as const;

export const EXPENSE_CONCEPT_MAX = 100;
export const EXPENSE_NOTES_MAX = 1000;
export const EXPENSE_CATEGORY_MAX = 40;
/** 1 000 000 €: de sobra para una casa. */
export const AMOUNT_MAX_CENTS = 100_000_000;
export const BILL_INTERVAL_MAX = 24;
/** Días de antelación con los que se avisa de una factura. */
export const BILL_NOTICE_DAYS = 3;

export interface ExpenseShare {
  userId: string;
  amount: Cents;
}

export interface Expense {
  id: string;
  concept: string;
  amount: Cents;
  date: IsoDate;
  category: string | null;
  notes: string;
  paidById: string;
  /** Lo que le toca a cada uno; suma exactamente el importe. */
  shares: ExpenseShare[];
  /** Factura fija de la que sale, si la hay. */
  billId: string | null;
  createdAt: string;
}

export interface ExpenseInput {
  concept: string;
  amount: Cents;
  date: IsoDate;
  category?: string | null;
  notes?: string;
  paidById: string;
  /** Entre quiénes se reparte a partes iguales. */
  participantIds: string[];
}

/** Pago entre dos personas para quedar en paz. */
export interface Settlement {
  id: string;
  fromId: string;
  toId: string;
  amount: Cents;
  date: IsoDate;
  createdAt: string;
}

export interface SettlementInput {
  fromId: string;
  toId: string;
  amount: Cents;
  date: IsoDate;
}

/** Saldo de una persona: positivo, le deben; negativo, debe. */
export interface Balance {
  userId: string;
  name: string;
  /** Si sigue en la casa (los que se fueron siguen contando si tienen cuentas pendientes). */
  member: boolean;
  paid: Cents;
  owed: Cents;
  balance: Cents;
}

export interface Transfer {
  fromId: string;
  toId: string;
  amount: Cents;
}

export interface Balances {
  balances: Balance[];
  /** Pagos mínimos para quedar en paz. */
  transfers: Transfer[];
}

/** Factura fija: llega cada N meses. */
export interface Bill {
  id: string;
  name: string;
  /** Importe aproximado, para avisar y proponerlo al pagar. */
  amount: Cents | null;
  /** Cada cuántos meses. */
  interval: number;
  nextDue: IsoDate;
  active: boolean;
  notes: string;
}

export interface BillInput {
  name: string;
  amount?: Cents | null;
  interval: number;
  nextDue: IsoDate;
  active?: boolean;
  notes?: string;
}

/** Al pagar una factura: el gasto que se crea. */
export interface PayBillInput {
  amount: Cents;
  date: IsoDate;
  paidById: string;
  participantIds: string[];
}

/** "12,50 €". */
export function formatEuros(cents: Cents): string {
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

/** Importe escrito a mano ("12,5", "12.50", "1.234,56", "8 €") a céntimos; null si no es válido. */
export function parseEuros(text: string): Cents | null {
  let t = text.replace(/€/g, '').replace(/\s/g, '');
  if (!t) return null;
  // Con coma decimal, los puntos son de miles; sin coma, un punto con 1 o 2 decimales es el decimal.
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (!/^\d+\.\d{1,2}$/.test(t)) t = t.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  return cents > 0 && cents <= AMOUNT_MAX_CENTS ? cents : null;
}

/**
 * Reparte un importe a partes iguales. Los céntimos que sobran van, uno a uno, a los primeros
 * de la lista: 10 € entre 3 = 3,34 + 3,33 + 3,33.
 */
export function splitEqually(amount: Cents, userIds: string[]): ExpenseShare[] {
  const base = Math.floor(amount / userIds.length);
  const rest = amount - base * userIds.length;
  return userIds.map((userId, i) => ({ userId, amount: base + (i < rest ? 1 : 0) }));
}

/**
 * Pagos para quedar en paz: el que más debe paga al que más le deben, hasta cuadrar.
 * Con n personas salen como mucho n − 1 pagos.
 */
export function settleUp(balances: { userId: string; balance: Cents }[]): Transfer[] {
  const debtors = balances.filter((b) => b.balance < 0).map((b) => ({ id: b.userId, left: -b.balance }));
  const creditors = balances.filter((b) => b.balance > 0).map((b) => ({ id: b.userId, left: b.balance }));
  debtors.sort((a, b) => b.left - a.left);
  creditors.sort((a, b) => b.left - a.left);
  const transfers: Transfer[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left);
    if (amount > 0) transfers.push({ fromId: debtors[i].id, toId: creditors[j].id, amount });
    debtors[i].left -= amount;
    creditors[j].left -= amount;
    if (!debtors[i].left) i++;
    if (!creditors[j].left) j++;
  }
  return transfers;
}

