import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { Comment, COMMENT_MAX, Member } from '@hogar/shared';
import { firstValueFrom } from 'rxjs';
import { agoText } from '../core/dates';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';
import { initials } from './people';

/** Comentarios de una tarea o una idea: la conversación y una caja para escribir. */
@Component({
  selector: 'app-comments',
  template: `
    <section class="comments" aria-label="Comentarios">
      <span class="lbl">Comentarios{{ comments().length ? ' (' + comments().length + ')' : '' }}</span>
      @if (loading()) {
        <p class="hint">Cargando…</p>
      } @else {
        <ul>
          @for (c of comments(); track c.id) {
            <li class="comment">
              <span class="avatar" [attr.data-c]="colorOf(c.authorId)" aria-hidden="true">{{ initials(c.authorName) }}</span>
              <div class="c-body">
                <div class="c-head">
                  <strong>{{ c.authorName }}</strong>
                  <span class="w">{{ ago(c.createdAt) }}</span>
                  @if (canDelete(c)) {
                    <button type="button" class="icon danger" [attr.aria-label]="'Borrar el comentario de ' + c.authorName" (click)="remove(c)">×</button>
                  }
                </div>
                <p>{{ c.text }}</p>
              </div>
            </li>
          }
        </ul>
      }
      <div class="c-new">
        <textarea aria-label="Escribe un comentario" placeholder="Escribe un comentario…" rows="2" [attr.maxlength]="max"
                  [value]="text()" (input)="text.set($any($event.target).value)"
                  (keydown.control.enter)="send()" (keydown.meta.enter)="send()"></textarea>
        <button type="button" class="btn sm" [disabled]="busy() || !text().trim()" (click)="send()">Comentar</button>
      </div>
      @if (error()) {
        <p class="form-err" role="alert">{{ error() }}</p>
      }
    </section>
  `,
})
export class Comments implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  /** Ruta de la API: /api/households/:id/tasks/:id/comments (o ideas). */
  readonly api = input.required<string>();
  /** Miembros de la casa, para el color de cada uno. */
  readonly members = input<Member[]>([]);
  /** Cuántos hay, cada vez que cambia (para el contador de la tarjeta). */
  readonly countChange = output<number>();

  protected readonly comments = signal<Comment[]>([]);
  protected readonly loading = signal(true);
  protected readonly text = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly max = COMMENT_MAX;
  protected readonly initials = initials;
  protected readonly ago = agoText;

  async ngOnInit() {
    try {
      this.comments.set(await firstValueFrom(this.http.get<Comment[]>(this.api())));
      this.countChange.emit(this.comments().length);
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudieron cargar los comentarios.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected colorOf(userId: string): string | null {
    return this.members().find((m) => m.id === userId)?.color ?? null;
  }

  protected canDelete(c: Comment): boolean {
    return c.authorId === this.session.user()?.id || this.session.isAdmin();
  }

  protected async send() {
    const text = this.text().trim();
    if (!text || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const comment = await firstValueFrom(this.http.post<Comment>(this.api(), { text }));
      this.comments.update((list) => [...list, comment]);
      this.text.set('');
      this.countChange.emit(this.comments().length);
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo enviar. Vuelve a intentarlo.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(c: Comment) {
    if (!confirm('¿Borrar este comentario?')) return;
    try {
      await firstValueFrom(this.http.delete(`${this.api()}/${c.id}`));
      this.comments.update((list) => list.filter((x) => x.id !== c.id));
      this.countChange.emit(this.comments().length);
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo borrar. Vuelve a intentarlo.'));
    }
  }
}
