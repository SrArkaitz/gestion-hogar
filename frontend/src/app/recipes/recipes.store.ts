import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { IsoDate, MenuEntry, MenuEntryInput, Recipe, RecipeInput, ShoppingItem, ShoppingLine } from '@hogar/shared';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/errors';

/** Recetario y menú de la casa activa. */
@Injectable({ providedIn: 'root' })
export class RecipesStore {
  private readonly http = inject(HttpClient);
  private householdId: string | null = null;

  readonly recipes = signal<Recipe[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private get api() {
    return `/api/households/${this.householdId}`;
  }

  async load(householdId: string): Promise<void> {
    this.householdId = householdId;
    this.loading.set(true);
    this.recipes.set([]);
    try {
      const recipes = await firstValueFrom(this.http.get<Recipe[]>(`${this.api}/recipes`));
      if (this.householdId !== householdId) return;
      this.recipes.set(recipes);
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

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/recipes/${id}`));
    this.recipes.update((list) => list.filter((r) => r.id !== id));
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

  async removeMenuEntry(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/menu/${id}`));
  }

  /** Pasa ingredientes a la lista de la compra (suma cantidades con lo que ya hubiera). */
  addToShopping(lines: ShoppingLine[]): Promise<ShoppingItem[]> {
    const items = lines.map((l) => ({ name: l.name, quantity: l.quantity }));
    return firstValueFrom(this.http.post<ShoppingItem[]>(`${this.api}/shopping/items/bulk`, { items }));
  }

  private upsert(recipe: Recipe) {
    this.recipes.update((list) => {
      const others = list.filter((r) => r.id !== recipe.id);
      return [...others, recipe].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    });
  }
}
