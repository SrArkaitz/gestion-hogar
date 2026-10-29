import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { InvitationPreview } from '@hogar/shared';
import { errorMessage } from '../core/errors';
import { HouseholdsService } from '../core/households.service';
import { SessionService } from '../core/session.service';

/** Página a la que lleva un enlace de invitación. */
@Component({
  selector: 'app-invitation-page',
  imports: [RouterLink],
  host: { class: 'auth' },
  template: `
    <div class="auth-card">
      <p class="brand">Hogar</p>
      @if (loading()) {
        <p class="lead">Cargando invitación…</p>
      } @else if (preview(); as p) {
        <h1>Te invitan a «{{ p.householdName }}»</h1>
        <p class="lead">{{ p.invitedBy }} te ha invitado a unirte a su casa para compartir tareas, ideas y demás.</p>
        @if (error()) {
          <p class="form-err" role="alert">{{ error() }}</p>
        }
        @if (!session.user()) {
          <p class="lead">Para unirte, crea una cuenta o entra con la que ya tienes.</p>
          <a class="btn" routerLink="/registro" [queryParams]="{ volver: here() }">Crear cuenta</a>
          <a class="btn ghost" routerLink="/entrar" [queryParams]="{ volver: here() }">Ya tengo cuenta</a>
        } @else if (p.alreadyMember) {
          <p class="lead">Ya eres miembro de esta casa.</p>
          <button type="button" class="btn" (click)="accept()">Ir a la casa</button>
        } @else {
          <button type="button" class="btn" [disabled]="busy()" (click)="accept()">
            {{ busy() ? 'Uniéndote…' : 'Unirme como ' + session.user()?.name }}
          </button>
          <a class="alt" routerLink="/">Ahora no</a>
        }
      } @else {
        <h1>Invitación no válida</h1>
        <p class="lead">{{ error() }}</p>
        <p class="lead">Pide a quien te invitó que te envíe un enlace nuevo.</p>
        <a class="btn ghost" routerLink="/">Ir al inicio</a>
      }
    </div>
  `,
})
export class InvitationPage implements OnInit {
  protected readonly session = inject(SessionService);
  private readonly households = inject(HouseholdsService);
  private readonly router = inject(Router);

  readonly token = input.required<string>();

  protected readonly here = computed(() => `/invitacion/${this.token()}`);
  protected readonly preview = signal<InvitationPreview | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  async ngOnInit() {
    // La sesión se carga antes para saber si quien abre el enlace ya es miembro.
    await this.session.ensureLoaded();
    try {
      this.preview.set(await this.households.previewInvitation(this.token()));
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo cargar la invitación.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async accept() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.session.upsertHousehold(await this.households.acceptInvitation(this.token()));
      this.router.navigate(['/tareas']);
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo aceptar la invitación.'));
    } finally {
      this.busy.set(false);
    }
  }
}
