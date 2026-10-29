import { Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ingredientQuantity,
  Meal,
  MEAL_LABELS,
  MEALS,
  RECIPE_DURATION_LABELS,
  RECIPE_KIND_LABELS,
  RECIPE_SERVINGS_MAX,
  shoppingLines,
  ShoppingLine,
} from '@hogar/shared';
import { todayIso, whenText } from '../core/dates';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';
import { RecipesStore } from './recipes.store';
import { ShoppingPreview } from './shopping-preview';

/** Ficha de una receta: ingredientes para las raciones elegidas, pasos, a la compra y al menú. */
@Component({
  selector: 'app-recipe-page',
  imports: [FormsModule, RouterLink, ShoppingPreview],
  host: { class: 'view' },
  templateUrl: './recipe.page.html',
})
export class RecipePage {
  protected readonly store = inject(RecipesStore);
  private readonly session = inject(SessionService);

  /** :id de la ruta. */
  readonly id = input.required<string>();

  protected readonly kindLabels = RECIPE_KIND_LABELS;
  protected readonly durationLabels = RECIPE_DURATION_LABELS;
  protected readonly meals = MEALS;
  protected readonly mealLabels = MEAL_LABELS;
  protected readonly servingsMax = RECIPE_SERVINGS_MAX;
  protected readonly quantity = ingredientQuantity;

  protected readonly recipe = computed(() => this.store.recipes().find((r) => r.id === this.id()) ?? null);
  protected readonly servings = signal(1);
  /** Cuánto se multiplican las cantidades de la receta. */
  protected readonly factor = computed(() => this.servings() / (this.recipe()?.servings ?? 1));

  protected readonly notice = signal('');
  protected readonly preview = signal<ShoppingLine[] | null>(null);
  private readonly previewDialog = viewChild(ShoppingPreview);

  // Diálogo "Al menú"
  protected readonly menuOpen = signal(false);
  protected readonly menuDate = signal(todayIso());
  protected readonly menuMeal = signal<Meal>('comida');
  protected readonly menuError = signal('');

  constructor() {
    effect(() => {
      const id = this.session.household()?.id;
      if (id) this.store.load(id);
    });
    // Al abrir una receta, las raciones empiezan en las suyas.
    effect(() => {
      const r = this.recipe();
      if (r) untracked(() => this.servings.set(r.servings));
    });
  }

  protected changeServings(delta: number) {
    this.servings.update((n) => Math.min(this.servingsMax, Math.max(1, n + delta)));
  }

  protected openPreview() {
    const r = this.recipe();
    if (r) this.preview.set(shoppingLines([{ ingredients: r.ingredients, factor: this.factor() }]));
  }

  protected async addToShopping(lines: ShoppingLine[]) {
    try {
      await this.store.addToShopping(lines);
      this.preview.set(null);
      this.notice.set(`${lines.length === 1 ? '1 ingrediente añadido' : `${lines.length} ingredientes añadidos`} a la compra.`);
    } catch (err) {
      this.previewDialog()?.showError(errorMessage(err, 'No se pudo añadir. Vuelve a intentarlo.'));
    }
  }

  protected async addToMenu() {
    const r = this.recipe();
    if (!r) return;
    this.menuError.set('');
    try {
      await this.store.addToMenu({ recipeId: r.id, date: this.menuDate(), meal: this.menuMeal(), servings: this.servings() });
      this.menuOpen.set(false);
      this.notice.set(`Añadida al menú: ${whenText(this.menuDate())}, ${MEAL_LABELS[this.menuMeal()].toLowerCase()}.`);
    } catch (err) {
      this.menuError.set(errorMessage(err, 'No se pudo añadir al menú.'));
    }
  }
}
