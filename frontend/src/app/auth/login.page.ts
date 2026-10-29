import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage, googleErrorMessage, safeReturnUrl } from '../core/errors';
import { SessionService } from '../core/session.service';
import { GoogleButton } from './google-button';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink, GoogleButton],
  host: { class: 'auth' },
  template: `
    <form class="auth-card" (ngSubmit)="submit()">
      <p class="brand">Hogar</p>
      <h1>Entrar</h1>
      @if (googleError()) {
        <p class="form-err" role="alert">{{ googleError() }}</p>
      }
      <app-google-button [volver]="target()" />
      @if (session.providers()?.google) {
        <p class="or"><span>o con tu correo</span></p>
      }
      <label>Correo
        <input type="email" name="email" autocomplete="email" required [(ngModel)]="email" />
      </label>
      <label>Contraseña
        <input type="password" name="password" autocomplete="current-password" required [(ngModel)]="password" />
      </label>
      @if (error()) {
        <p class="form-err" role="alert">{{ error() }}</p>
      }
      <button type="submit" class="btn" [disabled]="busy()">{{ busy() ? 'Entrando…' : 'Entrar' }}</button>
      <p class="alt">¿No tienes cuenta? <a routerLink="/registro" [queryParams]="{ volver: volver() }">Crea una</a></p>
    </form>
  `,
})
export class LoginPage {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);

  /** Ruta a la que volver después de entrar (?volver=…). */
  readonly volver = input<string>();
  /** Código con el que vuelve la API si falla el acceso con Google (?error=…). */
  readonly error_ = input<string>(undefined, { alias: 'error' });

  protected readonly target = computed(() => safeReturnUrl(this.volver()));
  protected readonly googleError = computed(() => googleErrorMessage(this.error_()));

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async submit() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.session.login({ email: this.email(), password: this.password() });
      this.router.navigateByUrl(this.target());
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo entrar. Vuelve a intentarlo.'));
    } finally {
      this.busy.set(false);
    }
  }
}
