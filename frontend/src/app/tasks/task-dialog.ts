import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Member,
  PRIORITIES,
  PRIORITY_LABELS,
  Priority,
  Task,
  TASK_CATEGORIES,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TaskInput,
  TaskStatus,
} from '@hogar/shared';

/** Formulario para crear o editar una tarea. */
@Component({
  selector: 'app-task-dialog',
  imports: [FormsModule],
  template: `
    <div class="veil" (click)="close.emit()">
      <form class="dlg" role="dialog" aria-modal="true" [attr.aria-label]="task() ? 'Editar tarea' : 'Nueva tarea'"
            (click)="$event.stopPropagation()" (keydown.escape)="close.emit()" (ngSubmit)="submit()">
        <h3>{{ task() ? 'Editar tarea' : 'Nueva tarea' }}</h3>

        <label>Título
          <input name="title" required maxlength="120" autocomplete="off" [(ngModel)]="title" />
        </label>
        <label>Notas
          <textarea name="notes" maxlength="2000" [(ngModel)]="notes"></textarea>
        </label>

        <div>
          <span class="lbl" id="prio-lbl">Prioridad</span>
          <div class="prio" role="group" aria-labelledby="prio-lbl">
            @for (p of priorities; track p) {
              <button type="button" [attr.data-v]="p" [attr.aria-pressed]="priority() === p" (click)="priority.set(p)">
                {{ priorityLabels[p] }}
              </button>
            }
          </div>
        </div>

        <div class="row">
          <label>Fecha límite
            <input type="date" name="due" [(ngModel)]="due" />
          </label>
          <label>Asignada a
            <select name="assignee" [(ngModel)]="assigneeId">
              <option value="">Nadie</option>
              @for (m of members(); track m.id) {
                <option [value]="m.id">{{ m.name }}</option>
              }
            </select>
          </label>
          <label>Categoría
            <input name="category" maxlength="40" list="task-categories" autocomplete="off" [(ngModel)]="category" />
            <datalist id="task-categories">
              @for (c of categoryOptions(); track c) {
                <option [value]="c"></option>
              }
            </datalist>
          </label>
        </div>

        @if (task()) {
          <label>Estado
            <select name="status" [(ngModel)]="status">
              @for (s of statuses; track s) {
                <option [value]="s">{{ statusLabels[s] }}</option>
              }
            </select>
          </label>
        }

        @if (error()) {
          <p class="form-err" role="alert">{{ error() }}</p>
        }

        <div class="acts">
          @if (task()) {
            <button type="button" class="btn danger" [disabled]="busy()" (click)="askDelete()">Borrar</button>
          }
          <div class="r">
            <button type="button" class="btn ghost" (click)="close.emit()">Cancelar</button>
            <button type="submit" class="btn" [disabled]="busy() || !title().trim()">Guardar</button>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class TaskDialog implements OnInit {
  /** Tarea a editar, o null para crear una nueva. */
  readonly task = input<Task | null>(null);
  readonly members = input.required<Member[]>();
  /** Categorías ya usadas en la casa, para sugerirlas. */
  readonly usedCategories = input<string[]>([]);
  readonly initialStatus = input<TaskStatus>('por_hacer');

  readonly save = output<TaskInput>();
  readonly delete = output<void>();
  readonly close = output<void>();

  protected readonly priorities = PRIORITIES;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly statuses = TASK_STATUSES;
  protected readonly statusLabels = TASK_STATUS_LABELS;

  protected readonly title = signal('');
  protected readonly notes = signal('');
  protected readonly priority = signal<Priority>('media');
  protected readonly due = signal('');
  protected readonly assigneeId = signal('');
  protected readonly category = signal('');
  protected readonly status = signal<TaskStatus>('por_hacer');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly categoryOptions = computed(() =>
    [...new Set([...TASK_CATEGORIES, ...this.usedCategories()])].sort((a, b) => a.localeCompare(b, 'es')),
  );

  ngOnInit() {
    const t = this.task();
    this.title.set(t?.title ?? '');
    this.notes.set(t?.notes ?? '');
    this.priority.set(t?.priority ?? 'media');
    this.due.set(t?.due ?? '');
    this.assigneeId.set(t?.assigneeId ?? '');
    this.category.set(t?.category ?? '');
    this.status.set(t?.status ?? this.initialStatus());
  }

  /** Lo llama el tablero cuando falla el guardado. */
  showError(message: string) {
    this.busy.set(false);
    this.error.set(message);
  }

  protected submit() {
    if (this.busy() || !this.title().trim()) return;
    this.busy.set(true);
    this.error.set('');
    this.save.emit({
      title: this.title(),
      notes: this.notes(),
      priority: this.priority(),
      status: this.status(),
      due: this.due() || null,
      assigneeId: this.assigneeId() || null,
      category: this.category().trim() || null,
    });
  }

  protected askDelete() {
    if (confirm('¿Borrar esta tarea? No se puede deshacer.')) {
      this.busy.set(true);
      this.delete.emit();
    }
  }
}
