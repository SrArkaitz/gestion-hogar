import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
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
  /** Sin conexión: hora de la lista guardada que se está viendo ("18:05"), o null si hay conexión. */
  readonly offline = signal<string | null>(null);
  /** Lo tachado sin conexión, pendiente de guardar: id → en el carro o no. Sobrevive a cerrar la app. */
  private readonly queue = signal<Record<string, boolean>>({});
  readonly queued = computed(() => Object.keys(this.queue()).length);
  private readonly onOnline = () => void this.poll();
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
    this.queue.set(readQueue(householdId));
    try {
      const [items, products] = await Promise.all([
        this.fetchItems(),
        firstValueFrom(this.http.get<ShoppingProduct[]>(`${this.api}/products`)),
      ]);
      if (this.householdId !== householdId) return;
      this.items.set(items);
      void this.flush();
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
    window.addEventListener('online', this.onOnline);
    this.timer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.poll();
    }, POLL_MS);
    document.addEventListener('visibilitychange', this.onVisible);
  }

  stopSync(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisible);
    window.removeEventListener('online', this.onOnline);
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

  /**
   * Al carro o de vuelta a la lista. Se ve al momento. Sin conexión se queda apuntado y se guarda
   * al volver; si falla por otra cosa, se deshace.
   */
  async toggle(item: ShoppingItem): Promise<void> {
    const done = !item.done;
    this.items.update((list) => list.map((i) => (i.id === item.id ? { ...i, done } : i)));
    if (this.offline() || this.queued()) return this.enqueue(item.id, done);
    try {
      await this.update(item.id, { done });
    } catch (err) {
      if (isNetworkError(err)) {
        this.markOffline();
        return this.enqueue(item.id, done);
      }
      this.items.update((list) => list.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)));
      throw err;
    }
  }

  private enqueue(id: string, done: boolean) {
    this.queue.update((q) => ({ ...q, [id]: done }));
    saveQueue(this.householdId!, this.queue());
  }

  /** Guarda lo tachado sin conexión. Se para al primer fallo de red (se reintenta más tarde). */
  private async flush(): Promise<void> {
    const householdId = this.householdId;
    if (!householdId || this.offline()) return;
    for (const [id, done] of Object.entries(this.queue())) {
      try {
        await this.mutate(() => firstValueFrom(this.http.patch<ShoppingItem>(`${this.api}/items/${id}`, { done })));
      } catch (err) {
        if (isNetworkError(err)) return this.markOffline();
        // 404: alguien lo quitó de la lista mientras tanto; otros errores, se descarta el cambio.
      }
      if (this.householdId !== householdId) return;
      this.queue.update((q) => {
        const { [id]: _, ...rest } = q;
        return rest;
      });
      saveQueue(householdId, this.queue());
    }
  }

  /** La lista del servidor (o la guardada, sin conexión) con lo tachado pendiente encima. */
  private async fetchItems(): Promise<ShoppingItem[]> {
    const res: HttpResponse<ShoppingItem[]> = await firstValueFrom(
      this.http.get<ShoppingItem[]>(`${this.api}/items`, { observe: 'response' }),
    );
    const savedAt = res.headers.get('X-Hogar-Offline');
    if (savedAt) this.markOffline(savedAt);
    else this.offline.set(null);
    const queue = this.queue();
    return (res.body ?? []).map((i) => (i.id in queue ? { ...i, done: queue[i.id] } : i));
  }

  private markOffline(savedAt?: string) {
    const date = savedAt && savedAt !== '1' ? new Date(savedAt) : null;
    const time = date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
    this.offline.set(time || this.offline() || '');
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
      const items = await this.fetchItems();
      if (this.householdId === householdId && !this.pending) this.items.set(items);
      if (!this.offline()) void this.flush();
    } catch (err) {
      // Sin conexión un momento (por ejemplo, en el súper): se vuelve a intentar en el siguiente.
      if (isNetworkError(err)) this.markOffline();
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

const queueKey = (householdId: string) => `hogar.compra.pendiente.${householdId}`;

function readQueue(householdId: string): Record<string, boolean> {
  try {
    const q = JSON.parse(localStorage.getItem(queueKey(householdId)) ?? '{}');
    return q && typeof q === 'object' ? q : {};
  } catch {
    return {};
  }
}

function saveQueue(householdId: string, queue: Record<string, boolean>) {
  try {
    if (Object.keys(queue).length) localStorage.setItem(queueKey(householdId), JSON.stringify(queue));
    else localStorage.removeItem(queueKey(householdId));
  } catch {
    // Sin almacenamiento (modo privado): lo pendiente se queda solo en memoria.
  }
}

/** Sin conexión (o la red no responde), no un error del servidor. */
function isNetworkError(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 0;
}
