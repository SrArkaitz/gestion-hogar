import { TitleCasePipe } from '@angular/common';
import { Component, ElementRef, OnInit, inject, input, output, signal, viewChild } from '@angular/core';
import { Card, CardInput, COLUMNS, ColumnId, PRIORITIES, Priority } from './card.model';

/** Formulario para crear o editar una tarjeta. */
@Component({
  selector: 'app-card-dialog',
  imports: [TitleCasePipe],
  templateUrl: './card-dialog.html',
  host: { '(document:keydown.escape)': 'cancel.emit()' },
})
export class CardDialog implements OnInit {
  /** Tarjeta a editar; null para crear una nueva. */
  readonly card = input<Card | null>(null);
  readonly defaultColumn = input<ColumnId>('hacer');

  readonly save = output<CardInput>();
  readonly delete = output<void>();
  readonly cancel = output<void>();

  protected readonly columns = COLUMNS;
  protected readonly priorities = PRIORITIES;

  protected readonly title = signal('');
  protected readonly note = signal('');
  protected readonly column = signal<ColumnId>('hacer');
  protected readonly priority = signal<Priority>('media');
  protected readonly due = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly confirmDelete = signal(false);

  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  private readonly host = inject(ElementRef);

  ngOnInit() {
    const c = this.card();
    this.title.set(c?.title ?? '');
    this.note.set(c?.note ?? '');
    this.column.set(c?.column ?? this.defaultColumn());
    this.priority.set(c?.priority ?? 'media');
    this.due.set(c?.due ?? '');
    setTimeout(() => this.titleInput()?.nativeElement.focus(), 30);
  }

  /** Para mostrar errores del servidor desde el componente padre. */
  showError(msg: string) {
    this.error.set(msg);
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected onVeilClick(e: MouseEvent) {
    if (e.target === this.host.nativeElement.firstElementChild) this.cancel.emit();
  }

  protected submit(e: Event) {
    e.preventDefault();
    const title = this.title().trim();
    if (!title) {
      this.error.set('Escribe un título para la tarjeta.');
      return;
    }
    this.error.set(null);
    this.save.emit({
      title,
      note: this.note().trim(),
      column: this.column(),
      priority: this.priority(),
      due: this.due(),
    });
  }

  protected onDelete() {
    if (!this.confirmDelete()) {
      this.confirmDelete.set(true);
      return;
    }
    this.delete.emit();
  }
}
