import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NAME_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@hogar/shared';
import { errorMessage, safeReturnUrl } from '../core/errors';
import { SessionService } from '../core/session.service';
import { GoogleButton } from './google-button';

@Component({
  selector: 'app-register-page',
  imports: [FormsModule, RouterLink, GoogleButton],
  host: { class: 'auth' },
  template: `
    <form class="auth-card" (ngSubmit)="submit()">
      <p class="brand">Hogar</p>
      <h1>Crear cuenta</h1>
      <app-google-button [volver]="target()" />
      @if (session.providers()?.google) {
        <p class="or"><span>o con tu correo</span></p>
      }
      <label>Nombre
        <input name="name" autocomplete="given-name" required [maxlength]="nameMax" [(ngModel)]="name" />
      </label>
      <label>Correo
        <input type="email" name="email" autocomplete="email" required [(ngModel)]="email" />
      </label>
      <label>Contraseña
        <input type="password" name="password" autocomplete="new-password" required [minlength]="passwordMin" [(ngModel)]="password" />
        <span class="hint">Al menos {{ passwordMin }} caracteres.</span>
      </label>
      @if (error()) {
        <p class="form-err" role="alert">{{ error() }}</p>
      }
      <button type="submit" class="btn" [disabled]="busy()">{{ busy() ? 'Creando…' : 'Crear cuenta' }}</button>
      <p class="alt">¿Ya tienes cuenta? <a routerLink="/entrar" [queryParams]="{ volver: volver() }">Entra</a></p>
    </form>
  `,
})
export class RegisterPage {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);

  /** Ruta a la que volver después de crear la cuenta (por ejemplo, una invitación). */
  readonly volver = input<string>();
  protected readonly target = computed(() => safeReturnUrl(this.volver()));

  protected readonly nameMax = NAME_MAX_LENGTH;
  protected readonly passwordMin = PASSWORD_MIN_LENGTH;
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async submit() {
    if (this.busy()) return;
    if (this.password().length < PASSWORD_MIN_LENGTH) {
      this.error.set(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.session.register({ name: this.name(), email: this.email(), password: this.password() });
      // Sin casa todavía: los guards llevan a /bienvenida salvo que vuelva a una invitación.
      this.router.navigateByUrl(this.target());
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo crear la cuenta. Vuelve a intentarlo.'));
    } finally {
      this.busy.set(false);
    }
  }
}
