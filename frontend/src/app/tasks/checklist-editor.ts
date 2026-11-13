import { Component, computed, input, model, output, signal } from '@angular/core';
import { CHECKLIST_MAX_ITEMS, CHECKLIST_TEXT_MAX, ChecklistItemInput } from '@hogar/shared';

/**
 * Lista dentro de una tarea (con casillas) o en la plantilla de una recurrente (solo textos).
 * Añadir, cambiar el texto o quitar se guarda con el formulario; tachar lo decide quien la usa.
 */
@Component({
  selector: 'app-checklist-editor',
  template: `
    <div class="checklist">
      <span class="lbl">
        Lista
        @if (checkable() && items().length) {
          <span class="ck-progress">{{ doneCount() }}/{{ items().length }}</span>
        }
      </span>
      @if (items().length) {
        <ul>
          @for (item of items(); track $index) {
            <li [class.done]="checkable() && item.done">
              @if (checkable()) {
                <input type="checkbox" [checked]="!!item.done" [attr.aria-label]="'Hecho: ' + item.text" (change)="toggle($index)" />
              }
              <input class="ck-text" [value]="item.text" [attr.maxlength]="textMax" [attr.aria-label]="'Cosa ' + ($index + 1) + ' de la lista'"
                     (input)="rename($index, $any($event.target).value)" (keydown.enter)="$event.preventDefault()" />
              <button type="button" class="icon" [attr.aria-label]="'Quitar ' + item.text" (click)="remove($index)">×</button>
            </li>
          }
        </ul>
      }
      @if (items().length < maxItems) {
        <div class="ck-add">
          <input #draftInput [value]="draft()" [attr.maxlength]="textMax" [placeholder]="placeholder()" aria-label="Añadir a la lista"
                 (input)="draft.set($any($event.target).value)" (keydown.enter)="$event.preventDefault(); add(draftInput)" />
          <button type="button" class="btn ghost sm" [disabled]="!draft().trim()" (click)="add(draftInput)">Añadir</button>
        </div>
      }
    </div>
  `,
})
export class ChecklistEditor {
  readonly items = model<ChecklistItemInput[]>([]);
  /** Con casillas para tachar (en una tarea) o solo textos (en una plantilla). */
  readonly checkable = input(true);
  readonly placeholder = input('Añadir a la lista… (horno, nevera)');
  /** Se ha tachado o destachado una cosa (ya cambiada en `items`). */
  readonly checked = output<ChecklistItemInput>();

  protected readonly draft = signal('');
  protected readonly maxItems = CHECKLIST_MAX_ITEMS;
  protected readonly textMax = CHECKLIST_TEXT_MAX;
  protected readonly doneCount = computed(() => this.items().filter((i) => i.done).length);

  protected add(field: HTMLInputElement) {
    const text = this.draft().trim();
    if (!text || this.items().length >= this.maxItems) return;
    this.items.update((list) => [...list, { text, done: false }]);
    this.draft.set('');
    // Se vacía también la caja: si se pulsa Intro muy rápido, la pantalla aún no se ha refrescado.
    field.value = '';
    field.focus();
  }

  protected rename(index: number, text: string) {
    this.items.update((list) => list.map((item, i) => (i === index ? { ...item, text } : item)));
  }

  protected remove(index: number) {
    this.items.update((list) => list.filter((_, i) => i !== index));
  }

  protected toggle(index: number) {
    let changed: ChecklistItemInput | undefined;
    this.items.update((list) =>
      list.map((item, i) => (i === index ? (changed = { ...item, done: !item.done }) : item)),
    );
    if (changed) this.checked.emit(changed);
  }
}
