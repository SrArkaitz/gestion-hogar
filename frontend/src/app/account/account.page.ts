import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import {
  NAME_MAX_LENGTH,
  NOTIFICATION_KIND_DESCRIPTIONS,
  NOTIFICATION_KIND_LABELS,
  NOTIFICATION_KINDS,
  NotificationKind,
  PASSWORD_MIN_LENGTH,
} from '@hogar/shared';
import { firstValueFrom } from 'rxjs';
import { GoogleButton } from '../auth/google-button';
import { Avatar, resizeAvatar } from '../core/avatar';
import { errorMessage, googleErrorMessage } from '../core/errors';
import { NotificationsService } from '../core/notifications.service';
import { SessionService } from '../core/session.service';
import { DevicePanel } from '../households/device-panel';
import { initials } from '../tasks/people';

/** Tu cuenta: foto, nombre, contraseña, Google, sesiones, qué avisos recibes y este dispositivo. */
@Component({
  selector: 'app-account-page',
  imports: [Avatar, FormsModule, GoogleButton, DevicePanel],
  host: { class: 'view' },
  templateUrl: './account.page.html',
})
export class AccountPage {
  protected readonly session = inject(SessionService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationsService);

  /** Código con el que vuelve la API si falla conectar Google (?error=…). */
  readonly error_ = input<string>(undefined, { alias: 'error' });
  protected readonly googleError = computed(() => googleErrorMessage(this.error_()));

  protected readonly initials = initials;
  protected readonly nameMax = NAME_MAX_LENGTH;
  protected readonly passwordMin = PASSWORD_MIN_LENGTH;
  protected readonly account = computed(() => this.session.me()?.account ?? null);

  protected readonly status = signal('');
  protected readonly error = signal('');

  // Nombre
  protected readonly name = signal('');

  // Foto
  protected readonly avatarBusy = signal(false);

  // Contraseña
  protected readonly current = signal('');
  protected readonly password = signal('');
  protected readonly repeat = signal('');
  protected readonly pwBusy = signal(false);
  protected readonly pwError = signal('');
  protected readonly mismatch = computed(() => !!this.repeat() && this.repeat() !== this.password());

  // Avisos
  protected readonly kinds = NOTIFICATION_KINDS;
  protected readonly kindLabels = NOTIFICATION_KIND_LABELS;
  protected readonly kindDescriptions = NOTIFICATION_KIND_DESCRIPTIONS;
  protected readonly notifyOff = computed(() => this.session.me()?.notifyOff ?? []);
  protected readonly kindsOn = computed(() => this.kinds.length - this.notifyOff().length);

  constructor() {
    // El campo empieza con tu nombre (y se pone al día si cambia).
    effect(() => this.name.set(this.session.user()?.name ?? ''));
  }

  protected async saveName() {
    const name = this.name().trim();
    if (!name || name === this.session.user()?.name) return;
    await this.run('Nombre cambiado.', async () => {
      await firstValueFrom(this.http.patch('/api/users/me', { name }));
      await this.session.refresh();
    });
  }

  protected async savePassword(form: NgForm) {
    if (this.mismatch()) return;
    const hadPassword = !!this.account()?.password;
    this.pwBusy.set(true);
    this.pwError.set('');
    this.status.set('');
    try {
      const body = hadPassword ? { current: this.current(), password: this.password() } : { password: this.password() };
      const { closed } = await firstValueFrom(this.http.put<{ closed: number }>('/api/auth/password', body));
      await this.session.refresh();
      form.resetForm();
      this.current.set(''); this.password.set(''); this.repeat.set('');
      const others = closed ? ` Se ha cerrado la sesión en ${closed === 1 ? 'otro dispositivo' : `${closed} dispositivos más`}.` : '';
      this.status.set((hadPassword ? 'Contraseña cambiada.' : 'Contraseña puesta: ya puedes entrar también con tu correo.') + others);
    } catch (err) {
      this.pwError.set(errorMessage(err, 'No se pudo cambiar la contraseña.'));
    } finally {
      this.pwBusy.set(false);
    }
  }

  protected async logoutOthers() {
    if (!confirm('¿Cerrar la sesión en todos tus otros dispositivos? Aquí seguirás dentro.')) return;
    await this.run('', async () => {
      const { closed } = await firstValueFrom(this.http.post<{ closed: number }>('/api/auth/logout-others', {}));
      this.status.set(
        closed ? `Sesión cerrada en ${closed === 1 ? 'otro dispositivo' : `${closed} dispositivos`}.` : 'No tenías la sesión abierta en ningún otro dispositivo.',
      );
    });
  }

  protected async unlinkGoogle() {
    if (!confirm('¿Desconectar Google? Seguirás entrando con tu correo y contraseña.')) return;
    await this.run('Google desconectado.', () => this.session.unlinkGoogle());
  }

  protected async logout() {
    this.notifications.stop();
    await this.session.logout();
    this.router.navigate(['/entrar']);
  }

  /** Recorta la foto en cuadrado, la reduce y la sube. */
  protected async pickAvatar(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.avatarBusy.set(true);
    try {
      await this.run('Foto de perfil guardada.', async () => {
        const blob = await resizeAvatar(file);
        await firstValueFrom(this.http.put('/api/users/me/avatar', blob, { headers: { 'Content-Type': 'image/jpeg' } }));
        await this.session.refresh();
      }, 'No se pudo subir la foto. Prueba con otra imagen.');
    } finally {
      this.avatarBusy.set(false);
    }
  }

  protected async removeAvatar() {
    if (!confirm('¿Quitar tu foto de perfil? Se verán tus iniciales.')) return;
    await this.run('Foto quitada.', async () => {
      await firstValueFrom(this.http.delete('/api/users/me/avatar'));
      await this.session.refresh();
    });
  }

  /** Activa o desactiva un tipo de aviso (para la persona, no para la casa). */
  protected async setKind(kind: NotificationKind, on: boolean) {
    const off = on ? this.notifyOff().filter((k) => k !== kind) : [...new Set([...this.notifyOff(), kind])];
    const label = this.kindLabels[kind].toLowerCase();
    await this.run(on ? `Te llegarán: ${label}.` : `Ya no te llegarán: ${label}.`, async () => {
      try {
        await firstValueFrom(this.http.put('/api/users/me/notifications', { off }));
      } finally {
        await this.session.refresh();
      }
    }, 'No se pudo guardar. Vuelve a intentarlo.');
  }

  private async run(success: string, action: () => Promise<void>, fallback = 'No se pudo completar. Vuelve a intentarlo.') {
    this.error.set('');
    this.status.set('');
    try {
      await action();
      if (success) this.status.set(success);
    } catch (err) {
      this.error.set(errorMessage(err, fallback));
    }
  }
}
