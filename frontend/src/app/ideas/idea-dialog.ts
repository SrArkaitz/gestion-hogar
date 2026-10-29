import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Idea, IDEA_CATEGORIES, IdeaInput } from '@hogar/shared';

/** Formulario para proponer o editar una idea. */
@Component({
  selector: 'app-idea-dialog',
  imports: [FormsModule],
  template: `
    <div class="veil" (click)="close.emit()">
      <form class="dlg" role="dialog" aria-modal="true" [attr.aria-label]="idea() ? 'Editar idea' : 'Nueva idea'"
            (click)="$event.stopPropagation()" (keydown.escape)="close.emit()" (ngSubmit)="submit()">
        <h3>{{ idea() ? 'Editar idea' : 'Nueva idea' }}</h3>

        <label>Título
          <input name="title" required maxlength="120" autocomplete="off" [(ngModel)]="title" />
        </label>
        <label>Descripción
          <textarea name="description" maxlength="2000" placeholder="Por qué, cuánto costaría, enlaces…" [(ngModel)]="description"></textarea>
        </label>
        <label>Categoría
          <input name="category" maxlength="40" list="idea-categories" autocomplete="off" [(ngModel)]="category" />
          <datalist id="idea-categories">
            @for (c of categoryOptions(); track c) {
              <option [value]="c"></option>
            }
          </datalist>
        </label>

        @if (error()) {
          <p class="form-err" role="alert">{{ error() }}</p>
        }

        <div class="acts">
          @if (canDelete()) {
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
export class IdeaDialog implements OnInit {
  /** Idea a editar, o null para proponer una nueva. */
  readonly idea = input<Idea | null>(null);
  readonly usedCategories = input<string[]>([]);
  /** Solo quien la propuso o un administrador pueden borrarla. */
  readonly canDelete = input(false);

  readonly save = output<IdeaInput>();
  readonly delete = output<void>();
  readonly close = output<void>();

  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly category = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly categoryOptions = computed(() =>
    [...new Set([...IDEA_CATEGORIES, ...this.usedCategories()])].sort((a, b) => a.localeCompare(b, 'es')),
  );

  ngOnInit() {
    const i = this.idea();
    this.title.set(i?.title ?? '');
    this.description.set(i?.description ?? '');
    this.category.set(i?.category ?? '');
  }

  /** Lo llama la página cuando falla el guardado. */
  showError(message: string) {
    this.busy.set(false);
    this.error.set(message);
  }

  protected submit() {
    if (this.busy() || !this.title().trim()) return;
    this.busy.set(true);
    this.error.set('');
    this.save.emit({ title: this.title(), description: this.description(), category: this.category().trim() || null });
  }

  protected askDelete() {
    if (confirm('¿Borrar esta idea? Si solo no os convence, mejor descártala: queda archivada.')) {
      this.busy.set(true);
      this.delete.emit();
    }
  }
}
