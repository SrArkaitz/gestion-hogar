import { Component, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SHOPPING_NAME_MAX,
  SHOPPING_QUANTITY_MAX,
  SHOPPING_SECTION_LABELS,
  SHOPPING_SECTIONS,
  ShoppingItem,
  ShoppingItemPatch,
  ShoppingSection,
} from '@hogar/shared';

/** Editar un artículo de la lista: nombre, cantidad y sección. */
@Component({
  selector: 'app-item-dialog',
  imports: [FormsModule],
  template: `
    <div class="veil" (click)="close.emit()">
      <form class="dlg" role="dialog" aria-modal="true" aria-label="Editar artículo"
            (click)="$event.stopPropagation()" (keydown.escape)="close.emit()" (ngSubmit)="submit()">
        <h3>Editar artículo</h3>
        <label>Nombre
          <input name="name" required [maxlength]="nameMax" autocomplete="off" [(ngModel)]="name" />
        </label>
        <div class="row two">
          <label>Cantidad
            <input name="quantity" [maxlength]="quantityMax" autocomplete="off" placeholder="2, 1 kg…" [(ngModel)]="quantity" />
          </label>
          <label>Sección
            <select name="section" [(ngModel)]="section">
              @for (s of sections; track s) {
                <option [value]="s">{{ sectionLabels[s] }}</option>
              }
            </select>
          </label>
        </div>
        <p class="hint">La sección se recuerda para la próxima vez que lo añadáis.</p>

        @if (error()) {
          <p class="form-err" role="alert">{{ error() }}</p>
        }
        <div class="acts">
          <button type="button" class="btn danger" [disabled]="busy()" (click)="busy.set(true); delete.emit()">Quitar de la lista</button>
          <div class="r">
            <button type="button" class="btn ghost" (click)="close.emit()">Cancelar</button>
            <button type="submit" class="btn" [disabled]="busy() || !name().trim()">Guardar</button>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class ItemDialog implements OnInit {
  readonly item = input.required<ShoppingItem>();
  readonly save = output<ShoppingItemPatch>();
  readonly delete = output<void>();
  readonly close = output<void>();

  protected readonly sections = SHOPPING_SECTIONS;
  protected readonly sectionLabels = SHOPPING_SECTION_LABELS;
  protected readonly nameMax = SHOPPING_NAME_MAX;
  protected readonly quantityMax = SHOPPING_QUANTITY_MAX;

  protected readonly name = signal('');
  protected readonly quantity = signal('');
  protected readonly section = signal<ShoppingSection>('otros');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  ngOnInit() {
    const item = this.item();
    this.name.set(item.name);
    this.quantity.set(item.quantity ?? '');
    this.section.set(item.section);
  }

  showError(message: string) {
    this.busy.set(false);
    this.error.set(message);
  }

  protected submit() {
    if (this.busy() || !this.name().trim()) return;
    this.busy.set(true);
    this.error.set('');
    this.save.emit({ name: this.name(), quantity: this.quantity().trim() || null, section: this.section() });
  }
}
