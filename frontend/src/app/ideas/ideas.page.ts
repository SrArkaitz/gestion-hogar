import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Idea, IDEA_STATUS_LABELS, IdeaInput, IdeaStatus, PRIORITIES, PRIORITY_LABELS, Priority } from '@hogar/shared';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';
import { IdeaDialog } from './idea-dialog';
import { IdeasStore } from './ideas.store';

type Tab = 'abiertas' | 'aceptadas' | 'descartadas';

const TAB_STATUSES: Record<Tab, IdeaStatus[]> = {
  abiertas: ['nueva', 'en_valoracion'],
  aceptadas: ['aceptada'],
  descartadas: ['descartada'],
};

@Component({
  selector: 'app-ideas-page',
  imports: [IdeaDialog, RouterLink],
  host: { class: 'view' },
  templateUrl: './ideas.page.html',
})
export class IdeasPage {
  protected readonly store = inject(IdeasStore);
  private readonly session = inject(SessionService);

  protected readonly statusLabels = IDEA_STATUS_LABELS;
  protected readonly priorities = PRIORITIES;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'abiertas', label: 'Abiertas' },
    { id: 'aceptadas', label: 'Aceptadas' },
    { id: 'descartadas', label: 'Descartadas' },
  ];

  protected readonly tab = signal<Tab>('abiertas');
  /** Diálogo de edición: undefined = cerrado, null = idea nueva. */
  protected readonly editing = signal<Idea | null | undefined>(undefined);
  /** Idea que se está aceptando (diálogo de prioridad). */
  protected readonly accepting = signal<Idea | null>(null);
  protected readonly acceptPriority = signal<Priority>('media');
  protected readonly acceptError = signal('');
  protected readonly busy = signal(false);
  /** Aviso tras aceptar, con enlace al tablero. */
  protected readonly notice = signal('');

  private readonly dialog = viewChild(IdeaDialog);
  private readonly householdId = computed(() => this.session.household()?.id);

  protected readonly memberNames = computed(() => new Map(this.store.members().map((m) => [m.id, m.name])));

  protected readonly counts = computed(() => {
    const ideas = this.store.ideas();
    const count = (t: Tab) => ideas.filter((i) => TAB_STATUSES[t].includes(i.status)).length;
    return { abiertas: count('abiertas'), aceptadas: count('aceptadas'), descartadas: count('descartadas') };
  });

  /** Ideas de la pestaña, de la más reciente a la más antigua. */
  protected readonly visible = computed(() =>
    this.store.ideas().filter((i) => TAB_STATUSES[this.tab()].includes(i.status)),
  );

  protected readonly categories = computed(() =>
    [...new Set(this.store.ideas().map((i) => i.category).filter((c): c is string => !!c))],
  );

  constructor() {
    effect(() => {
      const id = this.householdId();
      if (id) {
        this.notice.set('');
        this.store.load(id);
      }
    });
  }

  protected canDelete(idea: Idea): boolean {
    return idea.proposedById === this.session.user()?.id || this.session.isAdmin();
  }

  protected proposedBy(idea: Idea): string {
    const name = this.memberNames().get(idea.proposedById) ?? 'Alguien que ya no está';
    const date = new Date(idea.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    return `${name} · ${date}`;
  }

  protected async setStatus(idea: Idea, status: Exclude<IdeaStatus, 'aceptada'>) {
    this.store.error.set(null);
    try {
      await this.store.update(idea.id, { status });
    } catch (err) {
      this.store.error.set(errorMessage(err, 'No se pudo cambiar el estado. Vuelve a intentarlo.'));
    }
  }

  protected startAccept(idea: Idea) {
    this.acceptPriority.set('media');
    this.acceptError.set('');
    this.accepting.set(idea);
  }

  protected async confirmAccept() {
    const idea = this.accepting();
    if (!idea || this.busy()) return;
    this.busy.set(true);
    try {
      await this.store.accept(idea.id, this.acceptPriority());
      this.accepting.set(null);
      this.notice.set(`«${idea.title}» ya está en el tablero de tareas.`);
    } catch (err) {
      this.acceptError.set(errorMessage(err, 'No se pudo aceptar. Vuelve a intentarlo.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected open(idea: Idea) {
    this.editing.set(idea);
  }

  protected close() {
    this.editing.set(undefined);
  }

  protected async onSave(input: IdeaInput) {
    const idea = this.editing();
    try {
      if (idea) await this.store.update(idea.id, input);
      else {
        await this.store.create(input);
        this.tab.set('abiertas');
      }
      this.close();
    } catch (err) {
      this.dialog()?.showError(errorMessage(err, 'No se pudo guardar. Revisa la conexión y vuelve a intentarlo.'));
    }
  }

  protected async onDelete() {
    const idea = this.editing();
    if (!idea) return;
    try {
      await this.store.remove(idea.id);
      this.close();
    } catch (err) {
      this.dialog()?.showError(errorMessage(err, 'No se pudo borrar. Vuelve a intentarlo.'));
    }
  }
}
