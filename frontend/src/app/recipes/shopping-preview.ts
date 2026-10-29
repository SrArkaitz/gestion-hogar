import { Component, OnInit, input, output, signal } from '@angular/core';
import { ShoppingLine } from '@hogar/shared';

/**
 * Antes de pasar ingredientes a la compra: se ven todos y se desmarca lo que ya hay en casa.
 * Los que no llevan cantidad ("sal al gusto") salen desmarcados, porque suelen estar en la despensa.
 */
@Component({
  selector: 'app-shopping-preview',
  template: `
    <div class="veil" (click)="close.emit()">
      <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="sp-title" (click)="$event.stopPropagation()" (keydown.escape)="close.emit()">
        <h3 id="sp-title">{{ heading() }}</h3>
        @if (lines().length) {
          <p class="hint">Desmarca lo que ya tengas en casa. Si algo ya está en la lista, se suma.</p>
          <div class="sp-all">
            <button type="button" class="link" (click)="setAll(true)">Marcar todo</button>
            <button type="button" class="link" (click)="setAll(false)">Desmarcar todo</button>
          </div>
          <ul class="sp-list">
            @for (line of lines(); track line.key) {
              <li>
                <label class="check">
                  <input type="checkbox" [checked]="chosen().has(line.key)" (change)="toggle(line.key)" />
                  <span class="t">{{ line.name }}</span>
                  @if (line.quantity) {
                    <span class="q">{{ line.quantity }}</span>
                  }
                </label>
              </li>
            }
          </ul>
        } @else {
          <p class="n">No hay ingredientes que añadir.</p>
        }
        @if (error()) {
          <p class="form-err" role="alert">{{ error() }}</p>
        }
        <div class="acts">
          <div class="r">
            <button type="button" class="btn ghost" (click)="close.emit()">Cancelar</button>
            <button type="button" class="btn" [disabled]="busy() || !chosen().size" (click)="submit()">
              {{ chosen().size === 1 ? 'Añadir 1 a la compra' : 'Añadir ' + chosen().size + ' a la compra' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ShoppingPreview implements OnInit {
  readonly lines = input.required<ShoppingLine[]>();
  readonly heading = input('Añadir a la compra');
  readonly confirm = output<ShoppingLine[]>();
  readonly close = output<void>();

  protected readonly chosen = signal(new Set<string>());
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  ngOnInit() {
    this.chosen.set(new Set(this.lines().filter((l) => l.quantity !== null).map((l) => l.key)));
  }

  /** Lo llama la página si falla al guardar. */
  showError(message: string) {
    this.busy.set(false);
    this.error.set(message);
  }

  protected toggle(key: string) {
    this.chosen.update((set) => {
      const next = new Set(set);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  protected setAll(on: boolean) {
    this.chosen.set(new Set(on ? this.lines().map((l) => l.key) : []));
  }

  protected submit() {
    this.busy.set(true);
    this.error.set('');
    this.confirm.emit(this.lines().filter((l) => this.chosen().has(l.key)));
  }
}
