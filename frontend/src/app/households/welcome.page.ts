import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NAME_MAX_LENGTH } from '@hogar/shared';
import { errorMessage } from '../core/errors';
import { HouseholdsService } from '../core/households.service';
import { SessionService } from '../core/session.service';

/** Para quien tiene cuenta pero todavía no está en ninguna casa. */
@Component({
  selector: 'app-welcome-page',
  imports: [FormsModule],
  host: { class: 'auth' },
  template: `
    <form class="auth-card" (ngSubmit)="submit()">
      <p class="brand">Hogar</p>
      <h1>Hola, {{ session.user()?.name }}</h1>
      <p class="lead">Crea tu casa para empezar. Después podrás invitar a quien viva contigo.</p>
      <label>Nombre de la casa
        <input name="name" required [maxlength]="nameMax" placeholder="Por ejemplo: Piso de Bilbao" [(ngModel)]="name" />
      </label>
      @if (error()) {
        <p class="form-err" role="alert">{{ error() }}</p>
      }
      <button type="submit" class="btn" [disabled]="busy()">{{ busy() ? 'Creando…' : 'Crear casa' }}</button>
      <p class="alt">¿Te han invitado a una casa? Abre el enlace que te han enviado.</p>
      <p class="alt"><button type="button" class="link" (click)="logout()">Cerrar sesión</button></p>
    </form>
  `,
})
export class WelcomePage {
  protected readonly session = inject(SessionService);
  private readonly households = inject(HouseholdsService);
  private readonly router = inject(Router);

  protected readonly nameMax = NAME_MAX_LENGTH;
  protected readonly name = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async submit() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.session.upsertHousehold(await this.households.create(this.name()));
      this.router.navigate(['/tareas']);
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo crear la casa. Vuelve a intentarlo.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async logout() {
    await this.session.logout();
    this.router.navigate(['/entrar']);
  }
}
