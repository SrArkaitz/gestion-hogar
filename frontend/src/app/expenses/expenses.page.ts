import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Expense, ExpenseInput, formatEuros, Settlement, Transfer } from '@hogar/shared';
import { monthLabel, monthOf, monthRange, shiftMonth, todayIso } from '../core/dates';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';
import { initials } from '../tasks/people';
import { ExpenseDialog } from './expense-dialog';
import { ExpensesTabs } from './expenses-tabs';
import { ExpensesStore } from './expenses.store';

/** Un movimiento del mes: un gasto o un pago entre dos personas. */
type Movement = { kind: 'gasto'; date: string; item: Expense } | { kind: 'pago'; date: string; item: Settlement };

/** Saldos de la casa y gastos del mes. */
@Component({
  selector: 'app-expenses-page',
  imports: [ExpenseDialog, ExpensesTabs],
  host: { class: 'view' },
  templateUrl: './expenses.page.html',
})
export class ExpensesPage {
  protected readonly store = inject(ExpensesStore);
  private readonly session = inject(SessionService);

  protected readonly euros = formatEuros;
  protected readonly initials = initials;
  protected readonly me = computed(() => this.session.user()?.id ?? '');

  protected readonly month = signal(monthOf(todayIso()));
  protected readonly monthText = computed(() => monthLabel(this.month()));
  protected readonly isThisMonth = computed(() => this.month() === monthOf(todayIso()));
  protected readonly expenses = signal<Expense[]>([]);
  protected readonly settlements = signal<Settlement[]>([]);
  protected readonly loading = signal(true);
  protected readonly status = signal('');

  /** Diálogo: undefined = cerrado, null = gasto nuevo. */
  protected readonly editing = signal<Expense | null | undefined>(undefined);
  private readonly dialog = viewChild(ExpenseDialog);

  protected readonly movements = computed<Movement[]>(() =>
    [
      ...this.expenses().map((item) => ({ kind: 'gasto' as const, date: item.date, item })),
      ...this.settlements().map((item) => ({ kind: 'pago' as const, date: item.date, item })),
    ].sort((a, b) => b.date.localeCompare(a.date) || b.item.createdAt.localeCompare(a.item.createdAt)),
  );
  protected readonly monthTotal = computed(() => this.expenses().reduce((sum, e) => sum + e.amount, 0));
  protected readonly categories = computed(() => [...new Set(this.expenses().map((e) => e.category).filter((c): c is string => !!c))]);

  private readonly householdId = computed(() => this.session.household()?.id);
  /** Nombres de todos los que salen en los saldos, también de quien ya no está en la casa. */
  private readonly names = computed(
    () => new Map((this.store.balances()?.balances ?? []).map((b) => [b.userId, b.name])),
  );
  private readonly colors = computed(() => new Map(this.store.members().map((m) => [m.id, m.color])));

  constructor() {
    effect(() => {
      const id = this.householdId();
      if (id) this.store.load(id);
    });
    effect(() => {
      const id = this.householdId();
      const month = this.month();
      if (id) void this.loadMonth(month);
    });
  }

  protected name(id: string): string {
    return this.names().get(id) ?? this.store.members().find((m) => m.id === id)?.name ?? '¿?';
  }

  protected color(id: string): string | null {
    return this.colors().get(id) ?? null;
  }

  protected moveMonth(delta: number) {
    this.month.update((m) => shiftMonth(m, delta));
  }

  protected goThisMonth() {
    this.month.set(monthOf(todayIso()));
  }

  protected shortDate(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
  }

  protected async settle(t: Transfer) {
    if (!confirm(`¿Apuntar que ${this.name(t.fromId)} ha pagado ${formatEuros(t.amount)} a ${this.name(t.toId)}?`)) return;
    await this.run(`Apuntado: ${this.name(t.fromId)} → ${this.name(t.toId)}, ${formatEuros(t.amount)}.`, async () => {
      await this.store.settle({ ...t, date: todayIso() });
      await this.loadMonth(this.month());
    });
  }

  protected async removeSettlement(s: Settlement) {
    if (!confirm(`¿Borrar el pago de ${this.name(s.fromId)} a ${this.name(s.toId)} (${formatEuros(s.amount)})?`)) return;
    await this.run('Pago borrado.', async () => {
      await this.store.removeSettlement(s.id);
      await this.loadMonth(this.month());
    });
  }

  protected async onSave(input: ExpenseInput) {
    const editing = this.editing();
    try {
      const saved = await this.store.saveExpense(editing?.id ?? null, input);
      this.editing.set(undefined);
      // Si el gasto es de otro mes, se va a ese mes para verlo.
      if (monthOf(saved.date) !== this.month()) this.month.set(monthOf(saved.date));
      else await this.loadMonth(this.month());
    } catch (err) {
      this.dialog()?.showError(errorMessage(err, 'No se pudo guardar.'));
    }
  }

  protected async onDelete() {
    const editing = this.editing();
    if (!editing) return;
    try {
      await this.store.removeExpense(editing.id);
      this.editing.set(undefined);
      await this.loadMonth(this.month());
    } catch (err) {
      this.dialog()?.showError(errorMessage(err, 'No se pudo borrar.'));
    }
  }

  private async loadMonth(month: string) {
    this.loading.set(true);
    try {
      const { from, to } = monthRange(month);
      const [expenses, settlements] = await Promise.all([this.store.expenses(from, to), this.store.settlements(from, to)]);
      if (month !== this.month()) return;
      this.expenses.set(expenses);
      this.settlements.set(settlements);
    } catch (err) {
      this.status.set(errorMessage(err, 'No se pudieron cargar los gastos del mes.'));
    } finally {
      if (month === this.month()) this.loading.set(false);
    }
  }

  private async run(success: string, action: () => Promise<void>) {
    this.status.set('');
    try {
      await action();
      this.status.set(success);
    } catch (err) {
      this.status.set(errorMessage(err, 'No se pudo. Vuelve a intentarlo.'));
    }
  }
}
