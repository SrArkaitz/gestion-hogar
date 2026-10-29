import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  describeRecurrence,
  Member,
  occurrenceOnOrAfter,
  PRIORITIES,
  PRIORITY_LABELS,
  Priority,
  Recurrence,
  RECURRENCE_INTERVAL_MAX,
  RecurrenceFrequency,
  RecurringTask,
  RecurringTaskInput,
  TASK_CATEGORIES,
  WEEKDAY_INITIALS,
  WEEKDAY_NAMES,
  WEEKDAYS,
} from '@hogar/shared';
import { todayIso, whenText } from './dates';

const UNITS: Record<Exclude<RecurrenceFrequency, 'dias_semana'>, [string, string]> = {
  dias: ['día', 'días'],
  semanas: ['semana', 'semanas'],
  meses: ['mes', 'meses'],
};

/** Formulario para crear o editar una tarea recurrente. */
@Component({
  selector: 'app-recurring-dialog',
  imports: [FormsModule],
  template: `
    <div class="veil" (click)="close.emit()">
      <form class="dlg" role="dialog" aria-modal="true" [attr.aria-label]="heading()"
            (click)="$event.stopPropagation()" (keydown.escape)="close.emit()" (ngSubmit)="submit()">
        <h3>{{ heading() }}</h3>

        <label>Título
          <input name="title" required maxlength="120" autocomplete="off" [(ngModel)]="title" />
        </label>
        <label>Notas
          <textarea name="notes" maxlength="2000" [(ngModel)]="notes"></textarea>
        </label>

        <fieldset class="repeat">
          <legend class="lbl">Se repite</legend>
          <div class="row" [class.two]="frequency() !== 'dias_semana'" [class.one]="frequency() === 'dias_semana'">
            <label>Cómo
              <select name="frequency" [(ngModel)]="frequency">
                <option value="dias">Cada cierto número de días</option>
                <option value="semanas">Cada cierto número de semanas</option>
                <option value="meses">Cada cierto número de meses</option>
                <option value="dias_semana">Ciertos días de la semana</option>
              </select>
            </label>
            @if (frequency() !== 'dias_semana') {
              <label>Cada
                <span class="every">
                  <input type="number" name="interval" min="1" [max]="intervalMax" inputmode="numeric" [(ngModel)]="interval" />
                  <span>{{ unit() }}</span>
                </span>
              </label>
            }
          </div>
          @if (frequency() === 'dias_semana') {
            <div class="weekdays" role="group" aria-label="Días de la semana">
              @for (d of weekdayList; track d) {
                <button type="button" [attr.aria-pressed]="weekdays().includes(d)" [attr.aria-label]="weekdayNames[d - 1]"
                        (click)="toggleWeekday(d)">{{ weekdayInitials[d - 1] }}</button>
              }
            </div>
          }
          <label>{{ frequency() === 'dias_semana' ? 'Desde' : 'Empieza' }}
            <input type="date" name="startDate" required [(ngModel)]="startDate" />
          </label>
          <p class="hint">{{ startHint() }}</p>
          @if (preview(); as p) {
            <p class="preview" role="status">{{ p }}</p>
          }
        </fieldset>

        <div>
          <span class="lbl" id="rprio-lbl">Prioridad</span>
          <div class="prio" role="group" aria-labelledby="rprio-lbl">
            @for (p of priorities; track p) {
              <button type="button" [attr.data-v]="p" [attr.aria-pressed]="priority() === p" (click)="priority.set(p)">
                {{ priorityLabels[p] }}
              </button>
            }
          </div>
        </div>

        <div>
          <span class="lbl" id="rassignees-lbl">Asignada a</span>
          <div class="people" role="group" aria-labelledby="rassignees-lbl">
            @for (m of members(); track m.id) {
              <button type="button" [attr.data-c]="m.color" [attr.aria-pressed]="assigneeIds().includes(m.id)" (click)="toggleAssignee(m.id)">
                <span class="dot"></span>{{ m.name }}
              </button>
            }
          </div>
        </div>

        <label>Categoría
          <input name="category" maxlength="40" list="recurring-categories" autocomplete="off" [(ngModel)]="category" />
          <datalist id="recurring-categories">
            @for (c of categoryOptions(); track c) {
              <option [value]="c"></option>
            }
          </datalist>
        </label>

        @if (item()) {
          <label class="check">
            <input type="checkbox" name="active" [(ngModel)]="active" />
            Activa (si la desmarcas, deja de crear tareas hasta que la vuelvas a activar)
          </label>
        }

        @if (error()) {
          <p class="form-err" role="alert">{{ error() }}</p>
        }

        <div class="acts">
          @if (item()) {
            <button type="button" class="btn danger" [disabled]="busy()" (click)="askDelete()">Borrar</button>
          }
          <div class="r">
            <button type="button" class="btn ghost" (click)="close.emit()">Cancelar</button>
            <button type="submit" class="btn" [disabled]="busy() || !valid()">Guardar</button>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class RecurringDialog implements OnInit {
  /** Tarea recurrente a editar, o null para crear una nueva. */
  readonly item = input<RecurringTask | null>(null);
  readonly members = input.required<Member[]>();
  /** Categorías ya usadas en la casa, para sugerirlas. */
  readonly usedCategories = input<string[]>([]);

  readonly save = output<RecurringTaskInput>();
  readonly delete = output<void>();
  readonly close = output<void>();

  protected readonly priorities = PRIORITIES;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly weekdayList = WEEKDAYS;
  protected readonly weekdayInitials = WEEKDAY_INITIALS;
  protected readonly weekdayNames = WEEKDAY_NAMES;
  protected readonly intervalMax = RECURRENCE_INTERVAL_MAX;

  protected readonly title = signal('');
  protected readonly notes = signal('');
  protected readonly priority = signal<Priority>('media');
  protected readonly assigneeIds = signal<string[]>([]);
  protected readonly category = signal('');
  protected readonly frequency = signal<RecurrenceFrequency>('semanas');
  protected readonly interval = signal<number | null>(1);
  protected readonly weekdays = signal<number[]>([]);
  protected readonly startDate = signal(todayIso());
  protected readonly active = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly heading = computed(() => (this.item() ? 'Editar tarea recurrente' : 'Nueva tarea recurrente'));
  protected readonly categoryOptions = computed(() =>
    [...new Set([...TASK_CATEGORIES, ...this.usedCategories()])].sort((a, b) => a.localeCompare(b, 'es')),
  );

  protected readonly unit = computed(() => {
    const f = this.frequency();
    return f === 'dias_semana' ? '' : UNITS[f][this.interval() === 1 ? 0 : 1];
  });

  /** La frecuencia tal como quedaría, o null si aún falta algo. */
  private readonly recurrence = computed<Recurrence | null>(() => {
    const frequency = this.frequency();
    const interval = this.interval();
    const weekdays = [...this.weekdays()].sort();
    if (!this.startDate()) return null;
    if (frequency === 'dias_semana' ? !weekdays.length : !Number.isInteger(interval) || interval! < 1 || interval! > this.intervalMax) {
      return null;
    }
    return { frequency, interval: frequency === 'dias_semana' ? 1 : interval!, weekdays, startDate: this.startDate() };
  });

  protected readonly valid = computed(() => !!this.title().trim() && !!this.recurrence());

  /** "Cada 2 semanas, el lunes · próxima: lun 3 nov" */
  protected readonly preview = computed(() => {
    const r = this.recurrence();
    if (!r) return this.frequency() === 'dias_semana' ? 'Elige al menos un día.' : '';
    const item = this.item();
    // Al editar sin tocar la frecuencia, la próxima es la que ya tiene guardada.
    const unchanged =
      item && item.frequency === r.frequency && item.interval === r.interval && item.startDate === r.startDate && item.weekdays.join() === r.weekdays.join();
    const next = unchanged ? item.nextDate : occurrenceOnOrAfter(r, todayIso());
    return `${describeRecurrence(r)} · ${item ? 'próxima' : 'primera'}: ${whenText(next)}`;
  });

  protected readonly startHint = computed(() => {
    switch (this.frequency()) {
      case 'semanas':
        return 'Se repite el mismo día de la semana que esta fecha.';
      case 'meses':
        return 'Se repite el mismo día del mes; si un mes no lo tiene, el último día.';
      case 'dias_semana':
        return 'No se crea ninguna antes de esta fecha.';
      default:
        return 'La primera tarea se crea este día.';
    }
  });

  ngOnInit() {
    const r = this.item();
    if (!r) return;
    this.title.set(r.title);
    this.notes.set(r.notes);
    this.priority.set(r.priority);
    this.assigneeIds.set(r.assigneeIds);
    this.category.set(r.category ?? '');
    this.frequency.set(r.frequency);
    this.interval.set(r.interval);
    this.weekdays.set(r.weekdays);
    this.startDate.set(r.startDate);
    this.active.set(r.active);
  }

  /** Lo llama la página cuando falla el guardado. */
  showError(message: string) {
    this.busy.set(false);
    this.error.set(message);
  }

  protected toggleAssignee(id: string) {
    this.assigneeIds.update((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
  }

  protected toggleWeekday(day: number) {
    this.weekdays.update((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]));
  }

  protected submit() {
    const r = this.recurrence();
    if (this.busy() || !this.valid() || !r) return;
    this.busy.set(true);
    this.error.set('');
    this.save.emit({
      title: this.title(),
      notes: this.notes(),
      priority: this.priority(),
      category: this.category().trim() || null,
      assigneeIds: this.assigneeIds(),
      ...r,
      ...(this.item() && { active: this.active() }),
    });
  }

  protected askDelete() {
    if (confirm('¿Borrar esta tarea recurrente? Las tareas que ya creó se quedan en el tablero.')) {
      this.busy.set(true);
      this.delete.emit();
    }
  }
}
