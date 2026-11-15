import { Component, OnInit, inject, input, output, signal } from '@angular/core';
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
import { errorMessage } from '../core/errors';
import { resizePhoto } from '../recipes/photo';
import { ShoppingStore } from './shopping.store';

/** Editar un artículo de la lista: nombre, cantidad, sección y una foto opcional para reconocerlo. */
@Component({
  selector: 'app-item-dialog',
  imports: [FormsModule],
  template: `
    <div class="veil" (click)="close.emit()">
      <form class="dlg" role="dialog" aria-modal="true" aria-label="Editar artículo"
            (click)="$event.stopPropagation()" (keydown.escape)="close.emit()" (ngSubmit)="submit()">
        <h3>Editar artículo</h3>
        <label><span>Nombre <span class="req" aria-hidden="true">*</span></span>
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

        <div class="item-photo">
          <span class="lbl">Foto <span class="n">(opcional: la marca o el envase exacto)</span></span>
          @if (photoUrl(); as url) {
            <img [src]="url" alt="Foto de {{ item().name }}" />
          }
          <span class="photo-acts">
            <label class="link file">{{ photoUrl() ? 'Cambiar foto' : 'Añadir foto' }}
              <input type="file" accept="image/*" aria-label="Foto del artículo" (change)="pickPhoto($event)" />
            </label>
            @if (photoUrl()) {
              <button type="button" class="link danger" [disabled]="photoBusy()" (click)="removePhoto()">Quitar foto</button>
            }
            @if (photoBusy()) {
              <span class="n">Subiendo…</span>
            }
          </span>
        </div>

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
  private readonly store = inject(ShoppingStore);
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
  protected readonly photoUrl = signal<string | null>(null);
  protected readonly photoBusy = signal(false);

  ngOnInit() {
    const item = this.item();
    this.photoUrl.set(this.store.photoUrl(item));
    this.name.set(item.name);
    this.quantity.set(item.quantity ?? '');
    this.section.set(item.section);
  }

  /** La foto se guarda al momento (no hace falta darle a Guardar). */
  protected async pickPhoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.photoBusy.set(true);
    this.error.set('');
    try {
      const item = await this.store.setPhoto(this.item().id, await resizePhoto(file));
      this.photoUrl.set(this.store.photoUrl(item));
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo subir la foto. Hace falta conexión.'));
    } finally {
      this.photoBusy.set(false);
    }
  }

  protected async removePhoto() {
    this.photoBusy.set(true);
    try {
      await this.store.removePhoto(this.item().id);
      this.photoUrl.set(null);
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo quitar la foto.'));
    } finally {
      this.photoBusy.set(false);
    }
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
