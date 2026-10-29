import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  addDays,
  IsoDate,
  Meal,
  MEAL_LABELS,
  MEALS,
  MenuEntry,
  productKey,
  Recipe,
  RECIPE_KIND_LABELS,
  RECIPE_KINDS,
  RECIPE_SERVINGS_MAX,
  RecipeKind,
  shoppingLines,
  ShoppingLine,
  startOfWeek,
} from '@hogar/shared';
import { todayIso } from '../core/dates';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';
import { RecipesTabs } from './recipes-tabs';
import { RecipesStore } from './recipes.store';
import { ShoppingPreview } from './shopping-preview';

interface Slot {
  date: IsoDate;
  meal: Meal;
}

/** Menú de una semana (lunes a domingo): platos de comida y cena, y sus ingredientes a la compra. */
@Component({
  selector: 'app-menu-page',
  imports: [FormsModule, RouterLink, RecipesTabs, ShoppingPreview],
  host: { class: 'view' },
  templateUrl: './menu.page.html',
})
export class MenuPage {
  protected readonly store = inject(RecipesStore);
  private readonly session = inject(SessionService);

  protected readonly meals = MEALS;
  protected readonly mealLabels = MEAL_LABELS;
  protected readonly kinds = RECIPE_KINDS;
  protected readonly kindLabels = RECIPE_KIND_LABELS;
  protected readonly servingsMax = RECIPE_SERVINGS_MAX;
  protected readonly today = todayIso();

  protected readonly weekStart = signal(startOfWeek(this.today));
  protected readonly days = computed(() => Array.from({ length: 7 }, (_, i) => addDays(this.weekStart(), i)));
  protected readonly entries = signal<MenuEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly notice = signal('');

  protected readonly recipesById = computed(() => new Map(this.store.recipes().map((r) => [r.id, r])));

  // Elegir plato para un hueco
  protected readonly picking = signal<Slot | null>(null);
  protected readonly search = signal('');
  protected readonly kind = signal<RecipeKind | ''>('');
  protected readonly candidates = computed(() => {
    const q = productKey(this.search());
    return this.store.recipes().filter((r) => (!q || productKey(r.name).includes(q)) && (!this.kind() || r.kind === this.kind()));
  });

  // Editar un plato ya puesto
  protected readonly editing = signal<MenuEntry | null>(null);

  protected readonly preview = signal<ShoppingLine[] | null>(null);
  private readonly previewDialog = viewChild(ShoppingPreview);
  /** Ya se ha bajado hasta hoy (solo se hace la primera vez). */
  private scrolled = false;

  /** "26 oct – 1 nov". */
  protected readonly weekLabel = computed(() => `${this.dayText(this.weekStart(), false)} – ${this.dayText(addDays(this.weekStart(), 6), false)}`);
  protected readonly isThisWeek = computed(() => this.weekStart() === startOfWeek(this.today));

  constructor() {
    effect(() => {
      const id = this.session.household()?.id;
      if (id) this.store.load(id);
    });
    effect(() => {
      const id = this.session.household()?.id;
      const from = this.weekStart();
      if (id) void this.loadWeek(from);
    });
  }

  protected entriesFor(date: IsoDate, meal: Meal): MenuEntry[] {
    return this.entries().filter((e) => e.date === date && e.meal === meal);
  }

  /** "Lunes 26" o, sin el día de la semana, "26 oct". */
  protected dayText(date: IsoDate, weekday = true): string {
    const d = new Date(date + 'T00:00:00');
    if (!weekday) return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const text = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  protected moveWeek(weeks: number) {
    this.weekStart.update((d) => addDays(d, weeks * 7));
  }

  protected goToday() {
    this.weekStart.set(startOfWeek(this.today));
  }

  protected openPicker(slot: Slot) {
    this.search.set('');
    this.kind.set('');
    this.picking.set(slot);
  }

  protected async pick(recipe: Recipe) {
    const slot = this.picking();
    if (!slot) return;
    await this.run(async () => {
      const entry = await this.store.addToMenu({ ...slot, recipeId: recipe.id, servings: recipe.servings });
      this.entries.update((list) => [...list, entry]);
      this.picking.set(null);
    });
  }

  protected async changeServings(entry: MenuEntry, delta: number) {
    const servings = Math.min(this.servingsMax, Math.max(1, entry.servings + delta));
    if (servings === entry.servings) return;
    await this.run(async () => {
      const updated = await this.store.updateMenuEntry(entry.id, { servings });
      this.entries.update((list) => list.map((e) => (e.id === entry.id ? updated : e)));
      this.editing.set(updated);
    });
  }

  protected async removeEntry(entry: MenuEntry) {
    await this.run(async () => {
      await this.store.removeMenuEntry(entry.id);
      this.entries.update((list) => list.filter((e) => e.id !== entry.id));
      this.editing.set(null);
    });
  }

  protected openPreview() {
    const dishes = this.entries()
      .map((e) => ({ e, r: this.recipesById().get(e.recipeId) }))
      .filter((x): x is { e: MenuEntry; r: Recipe } => !!x.r)
      .map(({ e, r }) => ({ ingredients: r.ingredients, factor: e.servings / r.servings }));
    this.preview.set(shoppingLines(dishes));
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

  private async loadWeek(from: IsoDate) {
    this.loading.set(true);
    try {
      const entries = await this.store.menu(from, addDays(from, 6));
      if (from !== this.weekStart()) return;
      this.entries.set(entries);
      this.error.set('');
      this.scrollToToday(from);
    } catch (err) {
      if (from === this.weekStart()) this.error.set(errorMessage(err, 'No se pudo cargar el menú.'));
    } finally {
      if (from === this.weekStart()) this.loading.set(false);
    }
  }

  /** En el móvil los días van uno debajo de otro: al abrir esta semana, baja hasta hoy. */
  private scrollToToday(from: IsoDate) {
    if (this.scrolled || from !== startOfWeek(this.today) || !matchMedia('(max-width: 600px)').matches) return;
    this.scrolled = true;
    setTimeout(() => document.querySelector('.day.today')?.scrollIntoView({ block: 'start' }));
  }

  private async run(action: () => Promise<void>) {
    this.error.set('');
    try {
      await action();
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo. Vuelve a intentarlo.'));
    }
  }
}
