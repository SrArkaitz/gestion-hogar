import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { AcceptIdeaResult, Idea, IdeaInput, Member, Priority } from '@hogar/shared';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/errors';
import { HouseholdsService } from '../core/households.service';

/** Ideas y miembros de la casa activa, guardados en señales. */
@Injectable({ providedIn: 'root' })
export class IdeasStore {
  private readonly http = inject(HttpClient);
  private readonly households = inject(HouseholdsService);
  private householdId: string | null = null;

  readonly ideas = signal<Idea[]>([]);
  readonly members = signal<Member[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private get api() {
    return `/api/households/${this.householdId}/ideas`;
  }

  async load(householdId: string): Promise<void> {
    this.householdId = householdId;
    this.loading.set(true);
    this.ideas.set([]);
    try {
      const [ideas, household] = await Promise.all([
        firstValueFrom(this.http.get<Idea[]>(this.api)),
        this.households.get(householdId),
      ]);
      // Si se ha cambiado de casa mientras cargaba, esta respuesta ya no sirve.
      if (this.householdId !== householdId) return;
      this.ideas.set(ideas);
      this.members.set(household.members);
      this.error.set(null);
    } catch (err) {
      if (this.householdId === householdId) this.error.set(errorMessage(err, 'No se pudieron cargar las ideas.'));
    } finally {
      if (this.householdId === householdId) this.loading.set(false);
    }
  }

  async create(input: IdeaInput): Promise<void> {
    const idea = await firstValueFrom(this.http.post<Idea>(this.api, input));
    this.ideas.update((list) => [idea, ...list]);
  }

  async update(id: string, patch: Partial<IdeaInput>): Promise<void> {
    const idea = await firstValueFrom(this.http.patch<Idea>(`${this.api}/${id}`, patch));
    this.replace(idea);
  }

  /** Acepta la idea y crea su tarea, en el tablero del hogar o en tus personales. */
  async accept(id: string, priority: Priority, personal: boolean): Promise<void> {
    const { idea } = await firstValueFrom(this.http.post<AcceptIdeaResult>(`${this.api}/${id}/accept`, { priority, personal }));
    this.replace(idea);
  }

  /** API de los comentarios de una idea. */
  commentsApi(id: string): string {
    return `${this.api}/${id}/comments`;
  }

  /** Actualiza el contador de comentarios de la tarjeta. */
  setCommentCount(id: string, commentCount: number) {
    this.ideas.update((list) => list.map((i) => (i.id === id && i.commentCount !== commentCount ? { ...i, commentCount } : i)));
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/${id}`));
    this.ideas.update((list) => list.filter((i) => i.id !== id));
  }

  private replace(idea: Idea) {
    this.ideas.update((list) => list.map((i) => (i.id === idea.id ? idea : i)));
  }
}
