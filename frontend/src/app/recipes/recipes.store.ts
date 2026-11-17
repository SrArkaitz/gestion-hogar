import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { IsoDate, MenuEntry, MenuEntryInput, MenuSettings, Recipe, RecipeDraft, RecipeDuration, RecipeInput, RecipeKind, ShoppingItem, ShoppingLine } from '@hogar/shared';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/errors';

/** Recetario y menú de la casa activa. */
@Injectable({ providedIn: 'root' })
export class RecipesStore {
  private readonly http = inject(HttpClient);
  private householdId: string | null = null;

  /** «Mis recetas»: las guardadas de la casa (suyas y públicas de otras). Las favoritas, primero. */
  readonly recipes = signal<Recipe[]>([]);
  /** Otras que se han abierto sin estar guardadas (desde el buscador o el menú). */
  private readonly others = signal<Recipe[]>([]);
  readonly all = computed(() => [...this.recipes(), ...this.others()]);
  /** Las de la casa (guardadas o no): las que se pueden editar. */
  readonly own = computed(() => this.all().filter((r) => r.mine));
  /** Receta importada que espera en el formulario de «Nueva receta». */
  readonly draft = signal<RecipeDraft | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  /** Mensaje para enseñar al volver al recetario (p. ej., tras moderar una receta que ya no se ve). */
  readonly flash = signal('');

  private get api() {
    return `/api/households/${this.householdId}`;
  }

  async load(householdId: string): Promise<void> {
    // Al cambiar de casa no vale nada de lo anterior; en la misma, se refresca sin vaciar.
    if (this.householdId !== householdId) {
      this.recipes.set([]);
      this.others.set([]);
    }
    this.householdId = householdId;
    this.loading.set(true);
    try {
      const recipes = await firstValueFrom(this.http.get<Recipe[]>(`${this.api}/recipes`));
      if (this.householdId !== householdId) return;
      this.recipes.set(sorted(recipes));
      const saved = new Set(recipes.map((r) => r.id));
      this.others.update((list) => list.filter((r) => !saved.has(r.id)));
      this.error.set(null);
    } catch (err) {
      if (this.householdId === householdId) this.error.set(errorMessage(err, 'No se pudieron cargar las recetas.'));
    } finally {
      if (this.householdId === householdId) this.loading.set(false);
    }
  }

  /** Dirección de la foto; lleva el nombre del archivo para que el navegador la guarde sin miedo. */
  photoUrl(recipe: Recipe): string | null {
    return recipe.photo ? `${this.api}/recipes/${recipe.id}/photo?v=${recipe.photo}` : null;
  }

  async create(input: RecipeInput): Promise<Recipe> {
    const recipe = await firstValueFrom(this.http.post<Recipe>(`${this.api}/recipes`, input));
    this.upsert(recipe);
    return recipe;
  }

  async update(id: string, input: Partial<RecipeInput>): Promise<Recipe> {
    const recipe = await firstValueFrom(this.http.patch<Recipe>(`${this.api}/recipes/${id}`, input));
    this.upsert(recipe);
    return recipe;
  }

  /** Favorita de la casa (para todos sus miembros). Se ve al momento y se deshace si falla. */
  async setFavorite(recipe: Recipe, favorite: boolean): Promise<void> {
    this.upsert({ ...recipe, favorite, saved: recipe.saved || favorite });
    try {
      const saved = await firstValueFrom(
        favorite
          ? this.http.put<Recipe>(`${this.api}/recipes/${recipe.id}/favorite`, {})
          : this.http.delete<Recipe>(`${this.api}/recipes/${recipe.id}/favorite`),
      );
      this.upsert(saved);
    } catch (err) {
      this.upsert(recipe);
      throw err;
    }
  }

  /** La guarda en «Mis recetas» o la quita (sin borrarla). */
  async setSaved(recipe: Recipe, saved: boolean): Promise<Recipe> {
    const result = await firstValueFrom(
      saved
        ? this.http.put<Recipe>(`${this.api}/recipes/${recipe.id}/saved`, {})
        : this.http.delete<Recipe>(`${this.api}/recipes/${recipe.id}/saved`),
    );
    this.upsert(result);
    return result;
  }

  /** Buscador: todas las que ve la casa. */
  search(q: string, kind: RecipeKind | '', duration: RecipeDuration | ''): Promise<Recipe[]> {
    const params: Record<string, string> = {};
    if (q.trim()) params['q'] = q.trim();
    if (kind) params['kind'] = kind;
    if (duration) params['duration'] = duration;
    return firstValueFrom(this.http.get<Recipe[]>(`${this.api}/recipes/search`, { params }));
  }

  /** Lee la receta de una página web (no guarda nada). */
  importFrom(url: string): Promise<RecipeDraft> {
    return firstValueFrom(this.http.post<RecipeDraft>(`${this.api}/recipes/import`, { url }));
  }

  /** Vuelve a traer una receta (tras moderarla, por ejemplo). */
  async refresh(id: string): Promise<void> {
    const r = await firstValueFrom(this.http.get<Recipe>(`${this.api}/recipes/${id}`)).catch(() => null);
    if (r) this.upsert(r);
  }

  /** Trae las recetas que no están en «Mis recetas» (las de un plato del menú, una abierta desde el buscador…). */
  async ensure(ids: string[]): Promise<void> {
    const householdId = this.householdId;
    const known = new Set(this.all().map((r) => r.id));
    const missing = [...new Set(ids)].filter((id) => !known.has(id));
    const found = await Promise.all(
      missing.map((id) => firstValueFrom(this.http.get<Recipe>(`${this.api}/recipes/${id}`)).catch(() => null)),
    );
    if (householdId !== this.householdId) return;
    for (const r of found) if (r) this.upsert(r);
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/recipes/${id}`));
    this.recipes.update((list) => list.filter((r) => r.id !== id));
    this.others.update((list) => list.filter((r) => r.id !== id));
  }

  async setPhoto(id: string, photo: Blob): Promise<Recipe> {
    const recipe = await firstValueFrom(
      this.http.put<Recipe>(`${this.api}/recipes/${id}/photo`, photo, { headers: { 'Content-Type': photo.type } }),
    );
    this.upsert(recipe);
    return recipe;
  }

  async removePhoto(id: string): Promise<Recipe> {
    const recipe = await firstValueFrom(this.http.delete<Recipe>(`${this.api}/recipes/${id}/photo`));
    this.upsert(recipe);
    return recipe;
  }

  menu(from: IsoDate, to: IsoDate): Promise<MenuEntry[]> {
    return firstValueFrom(this.http.get<MenuEntry[]>(`${this.api}/menu`, { params: { from, to } }));
  }

  addToMenu(input: MenuEntryInput): Promise<MenuEntry> {
    return firstValueFrom(this.http.post<MenuEntry>(`${this.api}/menu`, input));
  }

  updateMenuEntry(id: string, patch: Partial<MenuEntryInput>): Promise<MenuEntry> {
    return firstValueFrom(this.http.patch<MenuEntry>(`${this.api}/menu/${id}`, patch));
  }

  menuSettings(): Promise<MenuSettings> {
    return firstValueFrom(this.http.get<MenuSettings>(`${this.api}/menu/settings`));
  }

  setMenuSettings(settings: MenuSettings): Promise<MenuSettings> {
    return firstValueFrom(this.http.put<MenuSettings>(`${this.api}/menu/settings`, settings));
  }

  async removeMenuEntry(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/menu/${id}`));
  }

  /** Pasa ingredientes a la lista de la compra (suma cantidades con lo que ya hubiera). */
  addToShopping(lines: ShoppingLine[]): Promise<ShoppingItem[]> {
    const items = lines.map((l) => ({ name: l.name, quantity: l.quantity }));
    return firstValueFrom(this.http.post<ShoppingItem[]>(`${this.api}/shopping/items/bulk`, { items }));
  }

  /** La pone en su sitio: en «Mis recetas» si está guardada; si no, aparte. */
  private upsert(recipe: Recipe) {
    const without = (list: Recipe[]) => list.filter((r) => r.id !== recipe.id);
    this.recipes.update((list) => sorted(recipe.saved ? [...without(list), recipe] : without(list)));
    this.others.update((list) => (recipe.saved ? without(list) : [...without(list), recipe]));
  }
}

/** Por nombre. */
function sorted(list: Recipe[]): Recipe[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
