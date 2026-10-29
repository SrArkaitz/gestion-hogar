import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Member, Task, TaskInput, TaskStatus } from '@hogar/shared';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/errors';
import { HouseholdsService } from '../core/households.service';

/** Tareas y miembros de la casa activa, guardados en señales. */
@Injectable({ providedIn: 'root' })
export class TasksStore {
  private readonly http = inject(HttpClient);
  private readonly households = inject(HouseholdsService);
  private householdId: string | null = null;

  readonly tasks = signal<Task[]>([]);
  readonly members = signal<Member[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private get api() {
    return `/api/households/${this.householdId}/tasks`;
  }

  async load(householdId: string): Promise<void> {
    this.householdId = householdId;
    this.loading.set(true);
    this.tasks.set([]);
    try {
      const [tasks, household] = await Promise.all([
        firstValueFrom(this.http.get<Task[]>(this.api)),
        this.households.get(householdId),
      ]);
      // Si se ha cambiado de casa mientras cargaba, esta respuesta ya no sirve.
      if (this.householdId !== householdId) return;
      this.tasks.set(tasks);
      this.members.set(household.members);
      this.error.set(null);
    } catch (err) {
      if (this.householdId === householdId) this.error.set(errorMessage(err, 'No se pudieron cargar las tareas.'));
    } finally {
      if (this.householdId === householdId) this.loading.set(false);
    }
  }

  async create(input: TaskInput): Promise<void> {
    const task = await firstValueFrom(this.http.post<Task>(this.api, input));
    this.tasks.update((list) => [...list, task]);
  }

  async update(id: string, patch: Partial<TaskInput>): Promise<void> {
    const task = await firstValueFrom(this.http.patch<Task>(`${this.api}/${id}`, patch));
    this.tasks.update((list) => list.map((t) => (t.id === id ? task : t)));
  }

  /** Mueve la tarea al instante en pantalla y deshace si falla el guardado. */
  async move(id: string, status: TaskStatus): Promise<void> {
    const before = this.tasks();
    this.tasks.update((list) => list.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      await this.update(id, { status });
    } catch (err) {
      this.tasks.set(before);
      this.error.set(errorMessage(err, 'No se pudo mover la tarea. Vuelve a intentarlo.'));
    }
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/${id}`));
    this.tasks.update((list) => list.filter((t) => t.id !== id));
  }
}
