import { Component, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarEvent, CalendarEventInput, EVENT_NOTES_MAX, EVENT_TITLE_MAX, IsoDate } from '@hogar/shared';

/** Crear o editar un evento del calendario. */
@Component({
  selector: 'app-event-dialog',
  imports: [FormsModule],
  template: `
    <div class="veil" (click)="close.emit()">
      <form class="dlg" role="dialog" aria-modal="true" [attr.aria-label]="event() ? 'Editar evento' : 'Nuevo evento'"
            (click)="$event.stopPropagation()" (keydown.escape)="close.emit()" (ngSubmit)="submit()" autocomplete="off">
        <h3>{{ event() ? 'Editar evento' : 'Nuevo evento' }}</h3>
        <label>Qué
          <input name="title" required [maxlength]="titleMax" placeholder="Cena con amigos" [(ngModel)]="title" />
        </label>
        <div class="row two">
          <label>Día
            <input type="date" name="date" required [(ngModel)]="date" />
          </label>
          <label>Hora <span class="hint">(opcional)</span>
            <input type="time" name="time" [(ngModel)]="time" />
          </label>
        </div>
        <label class="check">
          <input type="checkbox" name="multi" [(ngModel)]="multi" />
          Dura varios días
        </label>
        @if (multi()) {
          <label>Hasta
            <input type="date" name="endDate" [min]="date()" [(ngModel)]="endDate" />
          </label>
        }
        <label>Notas
          <textarea name="notes" [maxlength]="notesMax" [(ngModel)]="notes"></textarea>
        </label>
        @if (error()) {
          <p class="form-err" role="alert">{{ error() }}</p>
        }
        <div class="acts">
          @if (event()) {
            <button type="button" class="btn danger" [disabled]="busy()" (click)="askDelete()">Borrar</button>
          }
          <div class="r">
            <button type="button" class="btn ghost" (click)="close.emit()">Cancelar</button>
            <button type="submit" class="btn" [disabled]="busy() || !title().trim() || !date()">Guardar</button>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class EventDialog implements OnInit {
  readonly event = input<CalendarEvent | null>(null);
  /** Día con el que empieza un evento nuevo. */
  readonly day = input.required<IsoDate>();
  readonly save = output<CalendarEventInput>();
  readonly delete = output<void>();
  readonly close = output<void>();

  protected readonly titleMax = EVENT_TITLE_MAX;
  protected readonly notesMax = EVENT_NOTES_MAX;
  protected readonly title = signal('');
  protected readonly date = signal('');
  protected readonly time = signal('');
  protected readonly multi = signal(false);
  protected readonly endDate = signal('');
  protected readonly notes = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  ngOnInit() {
    const e = this.event();
    this.title.set(e?.title ?? '');
    this.date.set(e?.date ?? this.day());
    this.time.set(e?.time ?? '');
    this.multi.set(!!e?.endDate);
    this.endDate.set(e?.endDate ?? '');
    this.notes.set(e?.notes ?? '');
  }

  showError(message: string) {
    this.busy.set(false);
    this.error.set(message);
  }

  protected submit() {
    if (this.busy()) return;
    const end = this.multi() ? this.endDate() : '';
    if (end && end < this.date()) {
      this.error.set('La fecha de fin no puede ser anterior al día del evento.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.save.emit({ title: this.title(), date: this.date(), time: this.time() || null, endDate: end || null, notes: this.notes().trim() });
  }

  protected askDelete() {
    if (confirm('¿Borrar este evento?')) {
      this.busy.set(true);
      this.delete.emit();
    }
  }
}
