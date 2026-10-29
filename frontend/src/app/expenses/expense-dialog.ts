import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Expense,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_MAX,
  EXPENSE_CONCEPT_MAX,
  EXPENSE_NOTES_MAX,
  ExpenseInput,
  formatEuros,
  Member,
  parseEuros,
  splitEqually,
} from '@hogar/shared';
import { todayIso } from '../core/dates';

/**
 * Crear o editar un gasto. También sirve para pagar una factura (`fixedConcept`): entonces el
 * concepto y la categoría los pone la factura.
 */
@Component({
  selector: 'app-expense-dialog',
  imports: [FormsModule],
  template: `
    <div class="veil" (click)="close.emit()">
      <form class="dlg" role="dialog" aria-modal="true" [attr.aria-label]="heading()" (click)="$event.stopPropagation()"
            (keydown.escape)="close.emit()" (ngSubmit)="submit()" autocomplete="off">
        <h3>{{ heading() }}</h3>
        @if (!fixedConcept()) {
          <label>Concepto
            <input name="concept" required [maxlength]="max.concept" placeholder="Compra del súper" [(ngModel)]="concept" />
          </label>
        }
        <div class="row two">
          <label>Importe (€)
            <input name="amount" required inputmode="decimal" placeholder="0,00" [(ngModel)]="amountText" />
          </label>
          <label>Fecha
            <input type="date" name="date" required [(ngModel)]="date" />
          </label>
        </div>
        <label>Pagó
          <select name="paidBy" [(ngModel)]="paidById">
            @for (m of members(); track m.id) {
              <option [value]="m.id">{{ m.name }}</option>
            }
          </select>
        </label>
        <div>
          <span class="lbl" id="split-lbl">Se reparte entre</span>
          <div class="people" role="group" aria-labelledby="split-lbl">
            @for (m of members(); track m.id) {
              <button type="button" [attr.data-c]="m.color" [attr.aria-pressed]="participants().includes(m.id)" (click)="toggle(m.id)">
                <span class="dot"></span>{{ m.name }}
              </button>
            }
          </div>
          @if (shareText(); as text) {
            <p class="hint">{{ text }}</p>
          }
        </div>
        @if (!fixedConcept()) {
          <label>Categoría
            <input name="category" [maxlength]="max.category" list="expense-categories" [(ngModel)]="category" />
            <datalist id="expense-categories">
              @for (c of categoryOptions(); track c) {
                <option [value]="c"></option>
              }
            </datalist>
          </label>
          <label>Notas
            <textarea name="notes" [maxlength]="max.notes" [(ngModel)]="notes"></textarea>
          </label>
        }
        @if (expense()?.billId) {
          <p class="hint">Pago de una factura fija.</p>
        }
        @if (error()) {
          <p class="form-err" role="alert">{{ error() }}</p>
        }
        <div class="acts">
          @if (expense()) {
            <button type="button" class="btn danger" [disabled]="busy()" (click)="askDelete()">Borrar</button>
          }
          <div class="r">
            <button type="button" class="btn ghost" (click)="close.emit()">Cancelar</button>
            <button type="submit" class="btn" [disabled]="busy()">{{ fixedConcept() ? 'Apuntar pago' : 'Guardar' }}</button>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class ExpenseDialog implements OnInit {
  readonly expense = input<Expense | null>(null);
  readonly members = input.required<Member[]>();
  readonly me = input.required<string>();
  readonly usedCategories = input<string[]>([]);
  /** Al pagar una factura: su nombre (no se pide concepto ni categoría). */
  readonly fixedConcept = input<string | null>(null);
  /** Importe que se propone (el aproximado de la factura). */
  readonly suggestedAmount = input<number | null>(null);

  readonly save = output<ExpenseInput>();
  readonly delete = output<void>();
  readonly close = output<void>();

  protected readonly max = { concept: EXPENSE_CONCEPT_MAX, category: EXPENSE_CATEGORY_MAX, notes: EXPENSE_NOTES_MAX };

  protected readonly concept = signal('');
  protected readonly amountText = signal('');
  protected readonly date = signal(todayIso());
  protected readonly paidById = signal('');
  protected readonly participants = signal<string[]>([]);
  protected readonly category = signal('');
  protected readonly notes = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly heading = computed(() =>
    this.fixedConcept() ? `Pagar ${this.fixedConcept()}` : this.expense() ? 'Editar gasto' : 'Nuevo gasto',
  );
  protected readonly categoryOptions = computed(() =>
    [...new Set([...EXPENSE_CATEGORIES, ...this.usedCategories()])].sort((a, b) => a.localeCompare(b, 'es')),
  );

  /** "3,34 € cada uno" o el reparto exacto si no sale redondo. */
  protected readonly shareText = computed(() => {
    const amount = parseEuros(this.amountText());
    const ids = this.ordered();
    if (!amount || !ids.length) return '';
    const shares = splitEqually(amount, ids);
    if (ids.length === 1) return `Lo paga entero ${this.name(ids[0])}.`;
    if (shares.every((s) => s.amount === shares[0].amount)) return `${formatEuros(shares[0].amount)} cada uno.`;
    return shares.map((s) => `${this.name(s.userId)} ${formatEuros(s.amount)}`).join(' · ');
  });

  /** Participantes en el orden de la casa (el mismo que usa el servidor al repartir). */
  private readonly ordered = computed(() => this.members().map((m) => m.id).filter((id) => this.participants().includes(id)));

  ngOnInit() {
    const e = this.expense();
    if (e) {
      this.concept.set(e.concept);
      this.amountText.set((e.amount / 100).toFixed(2).replace('.', ','));
      this.date.set(e.date);
      this.paidById.set(e.paidById);
      this.participants.set(e.shares.map((s) => s.userId).filter((id) => this.members().some((m) => m.id === id)));
      this.category.set(e.category ?? '');
      this.notes.set(e.notes);
    } else {
      const suggested = this.suggestedAmount();
      if (suggested) this.amountText.set((suggested / 100).toFixed(2).replace('.', ','));
      this.paidById.set(this.members().some((m) => m.id === this.me()) ? this.me() : (this.members()[0]?.id ?? ''));
      this.participants.set(this.members().map((m) => m.id));
    }
  }

  showError(message: string) {
    this.busy.set(false);
    this.error.set(message);
  }

  protected toggle(id: string) {
    this.participants.update((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
  }

  protected submit() {
    if (this.busy()) return;
    const amount = parseEuros(this.amountText());
    const concept = this.fixedConcept() ?? this.concept().trim();
    const problem = !concept
      ? 'Escribe el concepto.'
      : !amount
        ? 'Importe no válido. Escríbelo como 12,50.'
        : !this.participants().length
          ? 'Elige entre quiénes se reparte.'
          : !this.date()
            ? 'Elige la fecha.'
            : '';
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.save.emit({
      concept,
      amount: amount!,
      date: this.date(),
      paidById: this.paidById(),
      participantIds: this.ordered(),
      category: this.category().trim() || null,
      notes: this.notes().trim(),
    });
  }

  protected askDelete() {
    if (confirm('¿Borrar este gasto? Los saldos se recalculan.')) {
      this.busy.set(true);
      this.delete.emit();
    }
  }

  private name(id: string): string {
    return this.members().find((m) => m.id === id)?.name ?? '';
  }
}
