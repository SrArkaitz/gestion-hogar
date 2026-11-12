import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { AppNotification, NotificationList } from '@hogar/shared';
import { firstValueFrom } from 'rxjs';

/** Cada cuánto se miran los avisos nuevos mientras la app está a la vista. */
const POLL_MS = 60_000;

/** Avisos de la campanita de quien ha entrado (de todas sus casas). */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly items = signal<AppNotification[]>([]);
  readonly unread = signal(0);

  /** Empieza a mirar avisos: ahora, cada minuto y al volver a la app. */
  start() {
    if (this.timer) return;
    void this.refresh();
    this.timer = setInterval(() => document.visibilityState === 'visible' && void this.refresh(), POLL_MS);
    document.addEventListener('visibilitychange', this.onVisible);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisible);
    this.items.set([]);
    this.unread.set(0);
  }

  async refresh(): Promise<void> {
    try {
      const { items, unread } = await firstValueFrom(this.http.get<NotificationList>('/api/notifications'));
      this.items.set(items);
      this.unread.set(unread);
    } catch {
      // Sin conexión o sin sesión: se vuelve a intentar en la siguiente vuelta.
    }
  }

  async markRead(n: AppNotification): Promise<void> {
    if (n.read) return;
    this.items.update((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    this.unread.update((u) => Math.max(0, u - 1));
    await firstValueFrom(this.http.post(`/api/notifications/${n.id}/read`, {})).catch(() => this.refresh());
  }

  async markAllRead(): Promise<void> {
    this.items.update((list) => list.map((x) => ({ ...x, read: true })));
    this.unread.set(0);
    await firstValueFrom(this.http.post('/api/notifications/read-all', {})).catch(() => this.refresh());
  }

  private readonly onVisible = () => {
    if (document.visibilityState === 'visible') void this.refresh();
  };
}
