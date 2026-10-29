import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Member,
  Priority,
  PRIORITIES,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  Task,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TaskInput,
  TaskStatus,
} from '@hogar/shared';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';
import { todayIso } from './dates';
import { assigneesLabel, assigneesOf, initials, stripeFor } from './people';
import { TaskDialog } from './task-dialog';
import { TasksStore } from './tasks.store';

/** Filtro por persona: todas, las mías, sin asignar o un miembro concreto (su id). */
type PersonFilter = 'todas' | 'mias' | 'nadie' | string;

@Component({
  selector: 'app-tasks-page',
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, RouterLink, TaskDialog],
  host: { class: 'view' },
  templateUrl: './tasks.page.html',
})
export class TasksPage {
  protected readonly store = inject(TasksStore);
  private readonly session = inject(SessionService);

  protected readonly statuses = TASK_STATUSES;
  protected readonly statusLabels = TASK_STATUS_LABELS;
  protected readonly priorities = PRIORITIES;
  protected readonly priorityLabels = PRIORITY_LABELS;

  protected readonly person = signal<PersonFilter>('todas');
  protected readonly category = signal<string>('');
  protected readonly priority = signal<Priority | ''>('');

  /** Diálogo abierto: undefined = cerrado, null = tarea nueva. */
  protected readonly editing = signal<Task | null | undefined>(undefined);
  protected readonly newStatus = signal<TaskStatus>('por_hacer');
  private readonly dialog = viewChild(TaskDialog);
  private justDragged = false;

  private readonly householdId = computed(() => this.session.household()?.id);
  private readonly today = todayIso();


  /** Categorías usadas en la casa, para el filtro y las sugerencias. */
  protected readonly categories = computed(() =>
    [...new Set(this.store.tasks().map((t) => t.category).filter((c): c is string => !!c))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    ),
  );

  protected readonly filtered = computed(() => {
    const me = this.session.user()?.id;
    const person = this.person();
    const category = this.category();
    const priority = this.priority();
    return this.store.tasks().filter(
      (t) =>
        (person === 'todas' ||
          (person === 'mias' && !!me && t.assigneeIds.includes(me)) ||
          (person === 'nadie' && !t.assigneeIds.length) ||
          t.assigneeIds.includes(person)) &&
        (!category || t.category === category) &&
        (!priority || t.priority === priority),
    );
  });

  /** Tareas de cada columna, por prioridad y luego por antigüedad. */
  protected readonly byStatus = computed(() => {
    const groups: Record<TaskStatus, Task[]> = { por_hacer: [], en_curso: [], hecho: [] };
    for (const t of this.filtered()) groups[t.status].push(t);
    for (const list of Object.values(groups)) {
      list.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.createdAt.localeCompare(b.createdAt));
    }
    return groups;
  });

  protected readonly filtering = computed(() => this.person() !== 'todas' || !!this.category() || !!this.priority());

  constructor() {
    effect(() => {
      const id = this.householdId();
      if (id) {
        this.person.set('todas');
        this.category.set('');
        this.store.load(id);
      }
    });
  }

  protected isLate(task: Task): boolean {
    return !!task.due && task.due < this.today && task.status !== 'hecho';
  }

  /** "10 ene", o "10 ene 2025" si no es de este año. */
  protected dueText(task: Task): string {
    const d = new Date(task.due + 'T00:00:00');
    const otherYear = task.due!.slice(0, 4) !== this.today.slice(0, 4);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', ...(otherYear && { year: 'numeric' }) });
  }

  protected assignees(task: Task): Member[] {
    return assigneesOf(this.store.members(), task.assigneeIds);
  }

  protected stripe(task: Task): string | null {
    return stripeFor(this.assignees(task));
  }

  protected assigneesLabel(task: Task): string {
    return assigneesLabel(this.assignees(task));
  }

  protected readonly initials = initials;

  protected clearFilters() {
    this.person.set('todas');
    this.category.set('');
    this.priority.set('');
  }

  protected value(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected onDrop(event: CdkDragDrop<TaskStatus, TaskStatus, string>) {
    this.justDragged = true;
    setTimeout(() => (this.justDragged = false), 50);
    if (event.previousContainer === event.container) return;
    this.store.move(event.item.data, event.container.data);
  }

  protected open(task: Task) {
    if (!this.justDragged) this.editing.set(task);
  }

  protected openNew(status: TaskStatus = 'por_hacer') {
    this.newStatus.set(status);
    this.editing.set(null);
  }

  protected close() {
    this.editing.set(undefined);
  }

  protected async onSave(input: TaskInput) {
    const task = this.editing();
    try {
      if (task) await this.store.update(task.id, input);
      else await this.store.create(input);
      this.close();
    } catch (err) {
      this.dialog()?.showError(errorMessage(err, 'No se pudo guardar. Revisa la conexión y vuelve a intentarlo.'));
    }
  }

  protected async onDelete() {
    const task = this.editing();
    if (!task) return;
    try {
      await this.store.remove(task.id);
      this.close();
    } catch (err) {
      this.dialog()?.showError(errorMessage(err, 'No se pudo borrar. Vuelve a intentarlo.'));
    }
  }
}
