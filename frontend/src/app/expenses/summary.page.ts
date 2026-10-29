import { Component, computed, effect, inject, signal } from '@angular/core';
import { Expense, formatEuros } from '@hogar/shared';
import { monthLabel, monthOf, monthRange, shiftMonth, todayIso } from '../core/dates';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';
import { initials } from '../tasks/people';
import { ExpensesTabs } from './expenses-tabs';
import { ExpensesStore } from './expenses.store';

interface Row {
  label: string;
  amount: number;
  /** Proporción respecto a la fila mayor, para la barra. */
  ratio: number;
}

/** Resumen de un mes: total, por categoría y por persona. */
@Component({
  selector: 'app-summary-page',
  imports: [ExpensesTabs],
  host: { class: 'view' },
  templateUrl: './summary.page.html',
})
export class SummaryPage {
  protected readonly store = inject(ExpensesStore);
  private readonly session = inject(SessionService);

  protected readonly euros = formatEuros;
  protected readonly initials = initials;

  protected readonly month = signal(monthOf(todayIso()));
  protected readonly monthText = computed(() => monthLabel(this.month()));
  protected readonly isThisMonth = computed(() => this.month() === monthOf(todayIso()));
  protected readonly expenses = signal<Expense[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected readonly total = computed(() => this.expenses().reduce((sum, e) => sum + e.amount, 0));

  protected readonly byCategory = computed(() => {
    const totals = new Map<string, number>();
    for (const e of this.expenses()) totals.set(e.category ?? 'Sin categoría', (totals.get(e.category ?? 'Sin categoría') ?? 0) + e.amount);
    return rows([...totals]);
  });

  /** Por persona: lo que pagó y lo que le tocaba de los gastos del mes. */
  protected readonly byPerson = computed(() => {
    const paid = new Map<string, number>(), share = new Map<string, number>();
    for (const e of this.expenses()) {
      paid.set(e.paidById, (paid.get(e.paidById) ?? 0) + e.amount);
      for (const s of e.shares) share.set(s.userId, (share.get(s.userId) ?? 0) + s.amount);
    }
    const ids = [...new Set([...paid.keys(), ...share.keys()])];
    const names = new Map((this.store.balances()?.balances ?? []).map((b) => [b.userId, b.name]));
    const colors = new Map(this.store.members().map((m) => [m.id, m.color]));
    return ids
      .map((id) => ({ id, name: names.get(id) ?? '¿?', color: colors.get(id) ?? null, paid: paid.get(id) ?? 0, share: share.get(id) ?? 0 }))
      .sort((a, b) => b.share - a.share);
  });

  constructor() {
    effect(() => {
      const id = this.session.household()?.id;
      if (id) this.store.load(id);
    });
    effect(() => {
      const id = this.session.household()?.id;
      const month = this.month();
      if (id) void this.loadMonth(month);
    });
  }

  protected moveMonth(delta: number) {
    this.month.update((m) => shiftMonth(m, delta));
  }

  protected goThisMonth() {
    this.month.set(monthOf(todayIso()));
  }

  private async loadMonth(month: string) {
    this.loading.set(true);
    try {
      const { from, to } = monthRange(month);
      const expenses = await this.store.expenses(from, to);
      if (month !== this.month()) return;
      this.expenses.set(expenses);
      this.error.set('');
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo cargar el resumen.'));
    } finally {
      if (month === this.month()) this.loading.set(false);
    }
  }
}

function rows(entries: [string, number][]): Row[] {
  const max = Math.max(1, ...entries.map(([, amount]) => amount));
  return entries
    .map(([label, amount]) => ({ label, amount, ratio: amount / max }))
    .sort((a, b) => b.amount - a.amount);
}
