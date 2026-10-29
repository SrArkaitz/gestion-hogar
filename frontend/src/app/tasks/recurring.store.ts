import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Member, RecurringTask, RecurringTaskInput } from '@hogar/shared';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/errors';
import { HouseholdsService } from '../core/households.service';

/** Tareas recurrentes y miembros de la casa activa. */
@Injectable({ providedIn: 'root' })
export class RecurringStore {
  private readonly http = inject(HttpClient);
  private readonly households = inject(HouseholdsService);
  private householdId: string | null = null;

  readonly items = signal<RecurringTask[]>([]);
  readonly members = signal<Member[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private get api() {
    return `/api/households/${this.householdId}/recurring`;
  }

  async load(householdId: string): Promise<void> {
    this.householdId = householdId;
    this.loading.set(true);
    this.items.set([]);
    try {
      const [items, household] = await Promise.all([
        firstValueFrom(this.http.get<RecurringTask[]>(this.api)),
        this.households.get(householdId),
      ]);
      // Si se ha cambiado de casa mientras cargaba, esta respuesta ya no sirve.
      if (this.householdId !== householdId) return;
      this.items.set(items);
      this.members.set(household.members);
      this.error.set(null);
    } catch (err) {
      if (this.householdId === householdId) this.error.set(errorMessage(err, 'No se pudieron cargar las tareas recurrentes.'));
    } finally {
      if (this.householdId === householdId) this.loading.set(false);
    }
  }

  async create(input: RecurringTaskInput): Promise<void> {
    const item = await firstValueFrom(this.http.post<RecurringTask>(this.api, input));
    this.items.update((list) => [...list, item]);
  }

  async update(id: string, patch: Partial<RecurringTaskInput>): Promise<void> {
    const item = await firstValueFrom(this.http.patch<RecurringTask>(`${this.api}/${id}`, patch));
    this.items.update((list) => list.map((i) => (i.id === id ? item : i)));
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/${id}`));
    this.items.update((list) => list.filter((i) => i.id !== id));
  }
}
