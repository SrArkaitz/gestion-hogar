import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { describeRecurrence, Member, PRIORITY_LABELS, RecurringTask, RecurringTaskInput } from '@hogar/shared';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';
import { whenText } from './dates';
import { assigneesLabel, assigneesOf, initials, stripeFor } from './people';
import { RecurringDialog } from './recurring-dialog';
import { RecurringStore } from './recurring.store';

/** Plantillas de tareas que se crean solas en el tablero cada cierto tiempo. */
@Component({
  selector: 'app-recurring-page',
  imports: [RouterLink, RecurringDialog],
  host: { class: 'view' },
  templateUrl: './recurring.page.html',
})
export class RecurringPage {
  protected readonly store = inject(RecurringStore);
  private readonly session = inject(SessionService);

  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly describe = describeRecurrence;
  protected readonly when = whenText;
  protected readonly initials = initials;

  /** Diálogo abierto: undefined = cerrado, null = nueva. */
  protected readonly editing = signal<RecurringTask | null | undefined>(undefined);
  protected readonly status = signal('');
  private readonly dialog = viewChild(RecurringDialog);
  private readonly householdId = computed(() => this.session.household()?.id);

  /** Activas por próxima fecha y, al final, las pausadas. */
  protected readonly sorted = computed(() =>
    [...this.store.items()].sort(
      (a, b) => Number(b.active) - Number(a.active) || a.nextDate.localeCompare(b.nextDate) || a.title.localeCompare(b.title, 'es'),
    ),
  );

  protected readonly categories = computed(() =>
    [...new Set(this.store.items().map((i) => i.category).filter((c): c is string => !!c))],
  );

  constructor() {
    effect(() => {
      const id = this.householdId();
      if (id) this.store.load(id);
    });
  }

  protected assignees(item: RecurringTask): Member[] {
    return assigneesOf(this.store.members(), item.assigneeIds);
  }

  protected stripe(item: RecurringTask): string | null {
    return stripeFor(this.assignees(item));
  }

  protected assigneesLabel(item: RecurringTask): string {
    return assigneesLabel(this.assignees(item));
  }

  protected async toggleActive(item: RecurringTask) {
    this.status.set('');
    try {
      await this.store.update(item.id, { active: !item.active });
    } catch (err) {
      this.status.set(errorMessage(err, 'No se pudo cambiar. Vuelve a intentarlo.'));
    }
  }

  protected async onSave(input: RecurringTaskInput) {
    const item = this.editing();
    try {
      if (item) await this.store.update(item.id, input);
      else await this.store.create(input);
      this.editing.set(undefined);
    } catch (err) {
      this.dialog()?.showError(errorMessage(err, 'No se pudo guardar. Revisa la conexión y vuelve a intentarlo.'));
    }
  }

  protected async onDelete() {
    const item = this.editing();
    if (!item) return;
    try {
      await this.store.remove(item.id);
      this.editing.set(undefined);
    } catch (err) {
      this.dialog()?.showError(errorMessage(err, 'No se pudo borrar. Vuelve a intentarlo.'));
    }
  }
}
