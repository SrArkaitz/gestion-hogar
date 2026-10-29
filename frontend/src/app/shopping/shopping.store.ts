import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { ShoppingItem, ShoppingItemInput, ShoppingItemPatch, ShoppingProduct } from '@hogar/shared';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/errors';

/** Cada cuánto se mira si alguien ha cambiado la lista (solo con la página visible). */
const POLL_MS = 4000;

/**
 * Lista de la compra de la casa activa. Mientras la página está abierta se actualiza sola,
 * para que dos personas puedan comprar a la vez cada una con su móvil.
 */
@Injectable({ providedIn: 'root' })
export class ShoppingStore {
  private readonly http = inject(HttpClient);
  private householdId: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Cambios propios aún sin respuesta: mientras haya, no se pisa la lista con lo que llega del servidor. */
  private pending = 0;
  private readonly onVisible = () => {
    if (document.visibilityState === 'visible') void this.poll();
  };

  readonly items = signal<ShoppingItem[]>([]);
  readonly products = signal<ShoppingProduct[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private get api() {
    return `/api/households/${this.householdId}/shopping`;
  }

  async load(householdId: string): Promise<void> {
    this.householdId = householdId;
    this.loading.set(true);
    this.items.set([]);
    try {
      const [items, products] = await Promise.all([
        firstValueFrom(this.http.get<ShoppingItem[]>(`${this.api}/items`)),
        firstValueFrom(this.http.get<ShoppingProduct[]>(`${this.api}/products`)),
      ]);
      if (this.householdId !== householdId) return;
      this.items.set(items);
      this.products.set(products);
      this.error.set(null);
    } catch (err) {
      if (this.householdId === householdId) this.error.set(errorMessage(err, 'No se pudo cargar la lista.'));
    } finally {
      if (this.householdId === householdId) this.loading.set(false);
    }
  }

  /** Empieza a mirar cambios de los demás. Se para con stopSync() al salir de la página. */
  startSync(): void {
    this.stopSync();
    this.timer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.poll();
    }, POLL_MS);
    document.addEventListener('visibilitychange', this.onVisible);
  }

  stopSync(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisible);
  }

  async add(input: ShoppingItemInput): Promise<void> {
    const item = await this.mutate(() => firstValueFrom(this.http.post<ShoppingItem>(`${this.api}/items`, input)));
    this.items.update((list) => (list.some((i) => i.id === item.id) ? list.map((i) => (i.id === item.id ? item : i)) : [...list, item]));
    void this.loadProducts();
  }

  async update(id: string, patch: ShoppingItemPatch): Promise<void> {
    const item = await this.mutate(() => firstValueFrom(this.http.patch<ShoppingItem>(`${this.api}/items/${id}`, patch)));
    this.items.update((list) => list.map((i) => (i.id === id ? item : i)));
    if (patch.section || patch.name) void this.loadProducts();
  }

  /** Al carro o de vuelta a la lista. Se ve al momento y se deshace si falla. */
  async toggle(item: ShoppingItem): Promise<void> {
    const done = !item.done;
    this.items.update((list) => list.map((i) => (i.id === item.id ? { ...i, done } : i)));
    try {
      await this.update(item.id, { done });
    } catch (err) {
      this.items.update((list) => list.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)));
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    await this.mutate(() => firstValueFrom(this.http.delete(`${this.api}/items/${id}`)));
    this.items.update((list) => list.filter((i) => i.id !== id));
  }

  async clearDone(): Promise<number> {
    const { removed } = await this.mutate(() =>
      firstValueFrom(this.http.post<{ removed: number }>(`${this.api}/items/clear-done`, {})),
    );
    this.items.update((list) => list.filter((i) => !i.done));
    return removed;
  }

  async forgetProduct(key: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/products/${encodeURIComponent(key)}`));
    this.products.update((list) => list.filter((p) => p.key !== key));
  }

  private async loadProducts(): Promise<void> {
    const householdId = this.householdId;
    try {
      const products = await firstValueFrom(this.http.get<ShoppingProduct[]>(`${this.api}/products`));
      if (this.householdId === householdId) this.products.set(products);
    } catch {
      // Solo son sugerencias: se reintentará en el próximo cambio.
    }
  }

  private async poll(): Promise<void> {
    const householdId = this.householdId;
    if (!householdId || this.pending) return;
    try {
      const items = await firstValueFrom(this.http.get<ShoppingItem[]>(`${this.api}/items`));
      if (this.householdId === householdId && !this.pending) this.items.set(items);
    } catch {
      // Sin conexión un momento (por ejemplo, en el súper): se vuelve a intentar en el siguiente.
    }
  }

  private async mutate<T>(request: () => Promise<T>): Promise<T> {
    this.pending++;
    try {
      return await request();
    } finally {
      this.pending--;
    }
  }
}
