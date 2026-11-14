import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppNotification } from '@hogar/shared';
import { agoText } from '../core/dates';
import { NotificationsService } from '../core/notifications.service';

/** Lo que hay que arrastrar un aviso hacia un lado para quitarlo. */
const SWIPE_PX = 90;

/**
 * Campanita con los avisos: cuántos hay sin leer y la lista al pulsarla. Cada aviso se quita
 * deslizándolo hacia un lado (o con la × en el PC); arriba se pueden quitar todos los leídos.
 */
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
          <span class="bell-acts">
            @if (service.unread()) {
              <button type="button" class="link" (click)="service.markAllRead()">Marcar todos como leídos</button>
            }
            @if (hasRead()) {
              <button type="button" class="link danger" (click)="service.removeRead()">Borrar leídos</button>
            }
          </span>
        </header>
        <ul>
          @for (n of service.items(); track n.id) {
            <li class="bell-row" [class.leaving]="leaving() === n.id" [class.dragging]="drag()?.id === n.id && drag()!.moved"
                [style.--dx.px]="drag()?.id === n.id ? drag()!.dx : (leaving() === n.id ? leaveDx : 0)"
                (pointerdown)="down($event, n)" (pointermove)="move($event)" (pointerup)="up(n)" (pointercancel)="cancel()">
              <span class="bell-gone" aria-hidden="true"><span>Quitar</span><span>Quitar</span></span>
              <button type="button" class="bell-item" [class.unread]="!n.read" (click)="go(n)">
                <span class="t">{{ n.title }}</span>
                <span class="b">{{ n.body }}</span>
                <span class="w">{{ when(n.createdAt) }}</span>
              </button>
              <button type="button" class="bell-x" [attr.aria-label]="'Quitar el aviso: ' + n.title" title="Quitar" (click)="remove(n)">×</button>
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
  protected readonly when = agoText;
  protected readonly hasRead = computed(() => this.service.items().some((n) => n.read));

  /** Aviso que se está arrastrando (dx: cuánto se ha movido). */
  protected readonly drag = signal<{ id: string; x0: number; y0: number; dx: number; moved: boolean } | null>(null);
  /** Aviso que sale de la lista (animación) antes de quitarlo. */
  protected readonly leaving = signal<string | null>(null);
  protected leaveDx = 0;
  /** El último gesto fue un arrastre: el click que llega después no abre el aviso. */
  private dragged = false;

  protected down(e: PointerEvent, n: AppNotification) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.dragged = false;
    this.drag.set({ id: n.id, x0: e.clientX, y0: e.clientY, dx: 0, moved: false });
  }

  protected move(e: PointerEvent) {
    const d = this.drag();
    if (!d) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    // Si va más en vertical, es para desplazar la lista: no se arrastra.
    if (!d.moved && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) return this.drag.set(null);
    if (!d.moved && Math.abs(dx) < 8) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    this.drag.set({ ...d, dx, moved: true });
  }

  protected up(n: AppNotification) {
    const d = this.drag();
    this.drag.set(null);
    if (!d?.moved) return;
    this.dragged = true;
    if (Math.abs(d.dx) >= SWIPE_PX) this.remove(n, d.dx > 0 ? 1 : -1);
  }

  protected cancel() {
    this.drag.set(null);
  }

  /** Lo saca hacia un lado y lo quita. */
  protected remove(n: AppNotification, side = 1) {
    this.leaveDx = side * 420;
    this.leaving.set(n.id);
    setTimeout(() => {
      this.leaving.set(null);
      void this.service.remove(n);
    }, 180);
  }

  protected toggle() {
    this.open.update((o) => !o);
    if (this.open()) void this.service.refresh();
  }

  protected async go(n: AppNotification) {
    if (this.dragged) {
      this.dragged = false;
      return;
    }
    this.open.set(false);
    void this.service.markRead(n);
    await this.router.navigateByUrl(n.url);
  }
}
