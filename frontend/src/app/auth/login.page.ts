import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage, safeReturnUrl } from '../core/errors';
import { SessionService } from '../core/session.service';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink],
  host: { class: 'auth' },
  template: `
    <form class="auth-card" (ngSubmit)="submit()">
      <p class="brand">Hogar</p>
      <h1>Entrar</h1>
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
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  /** Ruta a la que volver después de entrar (?volver=…). */
  readonly volver = input<string>();

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
      this.router.navigateByUrl(safeReturnUrl(this.volver()));
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo entrar. Vuelve a intentarlo.'));
    } finally {
      this.busy.set(false);
    }
  }
}
