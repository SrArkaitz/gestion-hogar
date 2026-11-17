import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  RECIPE_DURATION_LABELS,
  RECIPE_DURATIONS,
  RECIPE_KIND_LABELS,
  RECIPE_KINDS,
  Recipe,
  RecipeDuration,
  RecipeKind,
} from '@hogar/shared';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';
import { ImportDialog } from './import-dialog';
import { RecipesTabs } from './recipes-tabs';
import { RecipesStore } from './recipes.store';

/** Espera tras teclear antes de buscar. */
const DEBOUNCE_MS = 300;

/**
 * Buscador: las recetas de la casa (también las que no están en «Mis recetas») y las públicas de
 * las demás casas. Las que gustan se guardan en «Mis recetas».
 */
@Component({
  selector: 'app-recipe-search-page',
  imports: [FormsModule, ImportDialog, RouterLink, RecipesTabs],
  host: { class: 'view' },
  templateUrl: './recipe-search.page.html',
})
export class RecipeSearchPage {
  protected readonly store = inject(RecipesStore);
  private readonly session = inject(SessionService);

  protected readonly kinds = RECIPE_KINDS;
  protected readonly kindLabels = RECIPE_KIND_LABELS;
  protected readonly durations = RECIPE_DURATIONS;
  protected readonly durationLabels = RECIPE_DURATION_LABELS;

  protected readonly query = signal('');
  protected readonly kind = signal<RecipeKind | ''>('');
  protected readonly duration = signal<RecipeDuration | ''>('');
  protected readonly results = signal<Recipe[]>([]);
  protected readonly searching = signal(true);
  protected readonly error = signal('');
  /** Lo que se ha buscado (para el título de los resultados). */
  protected readonly searched = signal('');
  protected readonly importing = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  constructor() {
    effect(() => {
      const id = this.session.household()?.id;
      if (id) this.store.load(id);
    });
    // Busca al cambiar el texto (con una pequeña espera), el tipo, la duración o la casa.
    effect(() => {
      const q = this.query(), kind = this.kind(), duration = this.duration();
      if (!this.session.household()) return;
      untracked(() => {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.run(q, kind, duration), q === this.searched() ? 0 : DEBOUNCE_MS);
      });
    });
  }

  private async run(q: string, kind: RecipeKind | '', duration: RecipeDuration | '') {
    const seq = ++this.seq;
    this.searching.set(true);
    try {
      const results = await this.store.search(q, kind, duration);
      if (seq !== this.seq) return;
      this.results.set(results);
      this.searched.set(q);
      this.error.set('');
    } catch (err) {
      if (seq === this.seq) this.error.set(errorMessage(err, 'No se pudo buscar.'));
    } finally {
      if (seq === this.seq) this.searching.set(false);
    }
  }

  /** Guarda en «Mis recetas» (y lo refleja en el resultado). */
  protected async save(r: Recipe) {
    try {
      const saved = await this.store.setSaved(r, true);
      this.results.update((list) => list.map((x) => (x.id === saved.id ? saved : x)));
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo guardar.'));
    }
  }
}
