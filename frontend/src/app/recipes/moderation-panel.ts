import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MODERATION_REASON_MAX, MODERATION_REASONS, ModerationRecipeInfo, Recipe } from '@hogar/shared';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/errors';

type Action = 'unpublish' | 'remove-photo' | 'delete' | 'block';

const DONE: Record<Action, string> = {
  unpublish: 'Quitada de las públicas. Su casa ya lo sabe.',
  'remove-photo': 'Foto quitada. Su casa ya lo sabe.',
  delete: 'Receta borrada. Su casa ya lo sabe.',
  block: 'Esa casa ya no puede publicar y sus recetas son privadas. Lo puedes deshacer en Tu cuenta.',
};

/**
 * Panel de moderación en una receta pública de otra casa (solo lo ven los moderadores): de qué
 * casa es, un motivo y lo que se puede hacer. Cada acción avisa a esa casa con el motivo.
 */
@Component({
  selector: 'app-moderation-panel',
  imports: [FormsModule],
  host: { class: 'panel moderation' },
  template: `
    <h2>Moderación</h2>
    @if (info(); as i) {
      <p class="n">De la casa <strong>{{ i.householdName }}</strong>. Lo que hagas se les avisa con el motivo.</p>
      <div class="reasons" role="group" aria-label="Motivo">
        @for (r of reasons; track r) {
          <button type="button" class="chip" [attr.aria-pressed]="reason() === r" (click)="reason.set(r)">{{ r }}</button>
        }
      </div>
      <label><span class="sr-only">Motivo</span>
        <input name="mod-reason" [maxlength]="reasonMax" placeholder="O escribe el motivo" [(ngModel)]="reason" />
      </label>
      @if (error()) {
        <p class="form-err" role="alert">{{ error() }}</p>
      }
      <div class="mod-acts">
        <button type="button" class="btn ghost" [disabled]="busy() || !reason().trim()" (click)="act('unpublish')">Quitar de públicas</button>
        @if (recipe().photo) {
          <button type="button" class="btn ghost" [disabled]="busy() || !reason().trim()" (click)="act('remove-photo')">Quitar la foto</button>
        }
        <button type="button" class="btn danger" [disabled]="busy() || !reason().trim()" (click)="act('delete')">Borrar receta</button>
        <button type="button" class="link danger" [disabled]="busy() || !reason().trim()" (click)="act('block')">Impedir que esta casa publique</button>
      </div>
    } @else if (error()) {
      <p class="form-err" role="alert">{{ error() }}</p>
    }
  `,
})
export class ModerationPanel {
  private readonly http = inject(HttpClient);
  readonly recipe = input.required<Recipe>();
  /** Ya está hecho: el mensaje para enseñar y si la receta sigue a la vista. */
  readonly done = output<{ message: string; gone: boolean }>();

  protected readonly reasons = MODERATION_REASONS;
  protected readonly reasonMax = MODERATION_REASON_MAX;
  protected readonly info = signal<ModerationRecipeInfo | null>(null);
  protected readonly reason = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  constructor() {
    effect(() => void this.load(this.recipe().id));
  }

  private async load(id: string) {
    try {
      this.info.set(await firstValueFrom(this.http.get<ModerationRecipeInfo>(`/api/moderation/recipes/${id}`)));
      this.error.set('');
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo cargar la moderación.'));
    }
  }

  protected async act(action: Action) {
    const r = this.recipe(), i = this.info(), reason = this.reason().trim();
    if (!i || !reason) return;
    const what = { unpublish: 'quitar de las públicas', 'remove-photo': 'quitar la foto de', delete: 'borrar', block: 'impedir que publique la casa de' }[action];
    if (!confirm(`¿Seguro que quieres ${what} «${r.name}»?`)) return;
    this.busy.set(true);
    try {
      const body = { reason };
      if (action === 'block') await firstValueFrom(this.http.post(`/api/moderation/households/${i.householdId}/block`, body));
      else await firstValueFrom(this.http.post(`/api/moderation/recipes/${r.id}/${action}`, body));
      this.done.emit({ message: DONE[action], gone: action !== 'remove-photo' });
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo hacer.'));
    } finally {
      this.busy.set(false);
    }
  }
}
