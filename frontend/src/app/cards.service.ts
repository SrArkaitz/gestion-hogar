import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Card, CardInput } from './card.model';

/** Habla con la API de NestJS y guarda las tarjetas en una señal. */
@Injectable({ providedIn: 'root' })
export class CardsService {
  private readonly http = inject(HttpClient);
  private readonly api = '/api/cards';

  readonly cards = signal<Card[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.cards.set(await firstValueFrom(this.http.get<Card[]>(this.api)));
      this.error.set(null);
    } catch {
      this.error.set('No se pudo cargar el tablero. Comprueba que el servidor está encendido.');
    } finally {
      this.loading.set(false);
    }
  }

  async create(input: CardInput): Promise<void> {
    const card = await firstValueFrom(this.http.post<Card>(this.api, input));
    this.cards.update((list) => [...list, card]);
  }

  async update(id: string, patch: Partial<CardInput>): Promise<void> {
    const card = await firstValueFrom(this.http.patch<Card>(`${this.api}/${id}`, patch));
    this.cards.update((list) => list.map((c) => (c.id === id ? card : c)));
  }

  /** Mueve la tarjeta al instante en pantalla y deshace si falla el guardado. */
  async move(id: string, column: Card['column']): Promise<void> {
    const before = this.cards();
    this.cards.update((list) => list.map((c) => (c.id === id ? { ...c, column } : c)));
    try {
      await this.update(id, { column });
    } catch {
      this.cards.set(before);
      this.error.set('No se pudo mover la tarjeta. Vuelve a intentarlo.');
    }
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/${id}`));
    this.cards.update((list) => list.filter((c) => c.id !== id));
  }
}
