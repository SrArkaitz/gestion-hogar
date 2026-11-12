import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppNotification } from '@hogar/shared';
import { NotificationsService } from '../core/notifications.service';

/** "ahora", "hace 5 min", "hace 3 h", "ayer" o "5 nov". */
function whenText(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  if (hours < 48) return 'ayer';
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/** Campanita con los avisos: cuántos hay sin leer y la lista al pulsarla. */
@Component({
  selector: 'app-notifications-bell',
  template: `
    <button type="button" class="bell" [class.has]="service.unread() > 0" [attr.aria-expanded]="open()"
            [attr.aria-label]="service.unread() ? 'Avisos, ' + service.unread() + ' sin leer' : 'Avisos'" (click)="toggle()">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
      @if (service.unread()) {
        <span class="badge" aria-hidden="true">{{ service.unread() > 99 ? '99+' : service.unread() }}</span>
      }
    </button>
    @if (open()) {
      <div class="bell-veil" (click)="open.set(false)"></div>
      <section class="bell-panel" role="dialog" aria-label="Avisos" (keydown.escape)="open.set(false)">
        <header>
          <h2>Avisos</h2>
          @if (service.unread()) {
            <button type="button" class="link" (click)="service.markAllRead()">Marcar todos como leídos</button>
          }
        </header>
        <ul>
          @for (n of service.items(); track n.id) {
            <li>
              <button type="button" class="bell-item" [class.unread]="!n.read" (click)="go(n)">
                <span class="t">{{ n.title }}</span>
                <span class="b">{{ n.body }}</span>
                <span class="w">{{ when(n.createdAt) }}</span>
              </button>
            </li>
          } @empty {
            <li class="empty">No hay avisos. Aquí saldrán las tareas que te asignen y los recordatorios de las 9:00.</li>
          }
        </ul>
      </section>
    }
  `,
})
export class NotificationsBell {
  protected readonly service = inject(NotificationsService);
  private readonly router = inject(Router);
  protected readonly open = signal(false);
  protected readonly when = whenText;

  protected toggle() {
    this.open.update((o) => !o);
    if (this.open()) void this.service.refresh();
  }

  protected async go(n: AppNotification) {
    this.open.set(false);
    void this.service.markRead(n);
    await this.router.navigateByUrl(n.url);
  }
}
