import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Bill, BILL_INTERVAL_MAX, BILL_NOTICE_DAYS, EXPENSE_CONCEPT_MAX, ExpenseInput, formatEuros, parseEuros } from '@hogar/shared';
import { todayIso, whenText } from '../core/dates';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';
import { ExpenseDialog } from './expense-dialog';
import { ExpensesTabs } from './expenses-tabs';
import { ExpensesStore } from './expenses.store';

/** Facturas fijas: cuándo vence cada una y apuntar su pago como gasto. */
@Component({
  selector: 'app-bills-page',
  imports: [FormsModule, ExpenseDialog, ExpensesTabs],
  host: { class: 'view' },
  templateUrl: './bills.page.html',
})
export class BillsPage {
  protected readonly store = inject(ExpensesStore);
  private readonly session = inject(SessionService);

  protected readonly euros = formatEuros;
  protected readonly when = whenText;
  protected readonly today = todayIso();
  protected readonly nameMax = EXPENSE_CONCEPT_MAX;
  protected readonly intervalMax = BILL_INTERVAL_MAX;
  protected readonly me = computed(() => this.session.user()?.id ?? '');

  protected readonly status = signal('');
  /** Factura que se está pagando. */
  protected readonly paying = signal<Bill | null>(null);
  private readonly payDialog = viewChild(ExpenseDialog);

  // Crear o editar factura: undefined = cerrado, null = nueva.
  protected readonly editing = signal<Bill | null | undefined>(undefined);
  protected readonly name = signal('');
  protected readonly amountText = signal('');
  protected readonly interval = signal<number | null>(1);
  protected readonly nextDue = signal(todayIso());
  protected readonly active = signal(true);
  protected readonly formError = signal('');

  constructor() {
    effect(() => {
      const id = this.session.household()?.id;
      if (id) this.store.load(id);
    });
  }

  /** Vence en los próximos días (o ya venció): se resalta. */
  protected soon(bill: Bill): boolean {
    const limit = new Date(this.today + 'T00:00:00');
    limit.setDate(limit.getDate() + BILL_NOTICE_DAYS);
    return bill.active && new Date(bill.nextDue + 'T00:00:00') <= limit;
  }

  protected dueText(bill: Bill): string {
    const w = this.when(bill.nextDue);
    if (bill.nextDue < this.today) return `Venció el ${w}`;
    return w === 'hoy' || w === 'mañana' ? `Vence ${w}` : `Vence el ${w}`;
  }

  protected everyText(bill: Bill): string {
    if (bill.interval === 1) return 'Cada mes';
    if (bill.interval === 12) return 'Cada año';
    return `Cada ${bill.interval} meses`;
  }

  protected open(bill: Bill | null) {
    this.name.set(bill?.name ?? '');
    this.amountText.set(bill?.amount ? (bill.amount / 100).toFixed(2).replace('.', ',') : '');
    this.interval.set(bill?.interval ?? 1);
    this.nextDue.set(bill?.nextDue ?? todayIso());
    this.active.set(bill?.active ?? true);
    this.formError.set('');
    this.editing.set(bill);
  }

  protected async saveBill() {
    const amountText = this.amountText().trim();
    const amount = amountText ? parseEuros(amountText) : null;
    const interval = this.interval();
    if (!this.name().trim()) return this.formError.set('Escribe el nombre de la factura.');
    if (amountText && !amount) return this.formError.set('Importe no válido. Escríbelo como 45,90 o déjalo vacío.');
    if (!interval || interval < 1 || interval > this.intervalMax) return this.formError.set(`Cada cuántos meses: de 1 a ${this.intervalMax}.`);
    try {
      const bill = this.editing();
      await this.store.saveBill(bill?.id ?? null, {
        name: this.name(),
        amount,
        interval,
        nextDue: this.nextDue(),
        ...(bill && { active: this.active() }),
      });
      this.editing.set(undefined);
    } catch (err) {
      this.formError.set(errorMessage(err, 'No se pudo guardar.'));
    }
  }

  protected async removeBill() {
    const bill = this.editing();
    if (!bill || !confirm(`¿Borrar la factura «${bill.name}»? Los pagos ya apuntados se quedan en los gastos.`)) return;
    try {
      await this.store.removeBill(bill.id);
      this.editing.set(undefined);
    } catch (err) {
      this.formError.set(errorMessage(err, 'No se pudo borrar.'));
    }
  }

  protected async pay(input: ExpenseInput) {
    const bill = this.paying();
    if (!bill) return;
    try {
      await this.store.payBill(bill.id, { amount: input.amount, date: input.date, paidById: input.paidById, participantIds: input.participantIds });
      this.paying.set(null);
      const next = this.store.bills().find((b) => b.id === bill.id);
      this.status.set(`${bill.name}: pago apuntado en gastos.${next ? ` La próxima vence el ${this.when(next.nextDue)}.` : ''}`);
    } catch (err) {
      this.payDialog()?.showError(errorMessage(err, 'No se pudo apuntar el pago.'));
    }
  }
}
