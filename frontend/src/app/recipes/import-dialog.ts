import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { errorMessage } from '../core/errors';
import { RecipesStore } from './recipes.store';

/**
 * Importar una receta pegando el enlace de una web de recetas. El servidor lee la página y la
 * receta se abre en «Nueva receta» para revisarla antes de guardarla.
 */
@Component({
  selector: 'app-import-dialog',
  imports: [FormsModule],
  template: `
    <div class="veil" (click)="close.emit()">
      <form class="dlg" role="dialog" aria-modal="true" aria-labelledby="import-title" (click)="$event.stopPropagation()"
            (keydown.escape)="close.emit()" (ngSubmit)="import()" autocomplete="off">
        <h3 id="import-title">Importar receta de una web</h3>
        <label><span>Enlace de la receta <span class="req" aria-hidden="true">*</span></span>
          <input name="url" type="url" inputmode="url" required placeholder="https://…" [(ngModel)]="url" [disabled]="busy()" autofocus />
        </label>
        <p class="hint">Funciona con casi todas las webs de recetas. Antes de guardarla podrás revisarla y cambiar lo que quieras.</p>
        @if (error()) {
          <p class="form-err" role="alert">{{ error() }}</p>
        }
        <div class="acts">
          <div class="r">
            <button type="button" class="btn ghost" (click)="close.emit()">Cancelar</button>
            <button type="submit" class="btn" [disabled]="busy() || !url().trim()">{{ busy() ? 'Leyendo la receta…' : 'Importar' }}</button>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class ImportDialog {
  private readonly store = inject(RecipesStore);
  private readonly router = inject(Router);

  readonly close = output<void>();

  protected readonly url = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async import() {
    if (this.busy() || !this.url().trim()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.store.draft.set(await this.store.importFrom(this.url().trim()));
      await this.router.navigate(['/recetas/nueva']);
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo importar. Revisa el enlace y vuelve a intentarlo.'));
      this.busy.set(false);
    }
  }
}
