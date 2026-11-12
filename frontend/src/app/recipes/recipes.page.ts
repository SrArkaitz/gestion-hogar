import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  productKey,
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
import { RecipesTabs } from './recipes-tabs';
import { RecipesStore } from './recipes.store';

/** Recetario: buscar y filtrar por tipo de plato y duración. */
@Component({
  selector: 'app-recipes-page',
  imports: [FormsModule, RouterLink, RecipesTabs],
  host: { class: 'view' },
  templateUrl: './recipes.page.html',
})
export class RecipesPage {
  protected readonly store = inject(RecipesStore);
  private readonly session = inject(SessionService);

  protected readonly kinds = RECIPE_KINDS;
  protected readonly kindLabels = RECIPE_KIND_LABELS;
  protected readonly durations = RECIPE_DURATIONS;
  protected readonly durationLabels = RECIPE_DURATION_LABELS;

  protected readonly search = signal('');
  protected readonly kind = signal<RecipeKind | ''>('');
  protected readonly duration = signal<RecipeDuration | ''>('');
  /** Cuáles: todas, las favoritas de la casa, las que apuntaste tú, las de la casa o las públicas de otras. */
  protected readonly origin = signal<'' | 'fav' | 'me' | 'mine' | 'shared'>('');
  protected readonly hasShared = computed(() => this.store.recipes().some((r) => !r.mine));

  protected readonly filtered = computed(() => {
    const q = productKey(this.search());
    return this.store.recipes().filter(
      (r) =>
        (!q || productKey(r.name).includes(q) || r.ingredients.some((i) => productKey(i.name).includes(q))) &&
        (!this.kind() || r.kind === this.kind()) &&
        (!this.duration() || r.duration === this.duration()) &&
        this.matchesOrigin(r),
    );
  });
  protected readonly filtering = computed(() => !!this.search().trim() || !!this.kind() || !!this.duration() || !!this.origin());

  constructor() {
    effect(() => {
      const id = this.session.household()?.id;
      if (id) this.store.load(id);
    });
  }

  private matchesOrigin(r: Recipe): boolean {
    switch (this.origin()) {
      case 'fav':
        return r.favorite;
      case 'me':
        return r.mine && r.createdById === this.session.user()?.id;
      case 'mine':
        return r.mine;
      case 'shared':
        return !r.mine;
      default:
        return true;
    }
  }

  protected async toggleFavorite(r: Recipe, event: Event) {
    event.preventDefault();
    try {
      await this.store.setFavorite(r, !r.favorite);
    } catch (err) {
      this.store.error.set(errorMessage(err, 'No se pudo guardar la favorita.'));
    }
  }

  protected clearFilters() {
    this.search.set('');
    this.kind.set('');
    this.duration.set('');
    this.origin.set('');
  }
}
