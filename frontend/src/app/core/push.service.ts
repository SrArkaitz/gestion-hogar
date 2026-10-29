import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { PushConfig } from '@hogar/shared';
import { firstValueFrom } from 'rxjs';
import { InstallService } from './install.service';

/**
 * Estado de los avisos en este dispositivo:
 * - no-soportado: el navegador no puede recibirlos.
 * - instalar-primero: iPhone o iPad sin la app instalada (Safari solo los da a la app instalada).
 * - bloqueado: se denegó el permiso; se cambia en los ajustes del navegador.
 */
export type PushState = 'cargando' | 'no-soportado' | 'instalar-primero' | 'bloqueado' | 'desactivado' | 'activado';

/** Activa y desactiva los avisos push de este dispositivo (cada navegador tiene su suscripción). */
@Injectable({ providedIn: 'root' })
export class PushClientService {
  private readonly http = inject(HttpClient);
  private readonly install = inject(InstallService);

  readonly state = signal<PushState>('cargando');

  private get supported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  /** Mira cómo está este dispositivo. Si ya tenía avisos, se los vuelve a apuntar a la cuenta actual. */
  async refresh(): Promise<void> {
    if (!this.supported) {
      this.state.set(this.install.isIos && !this.install.installed() ? 'instalar-primero' : 'no-soportado');
      return;
    }
    if (Notification.permission === 'denied') {
      this.state.set('bloqueado');
      return;
    }
    const sub = await this.subscription();
    if (sub && Notification.permission === 'granted') {
      await this.save(sub);
      this.state.set('activado');
    } else {
      this.state.set('desactivado');
    }
  }

  /** Pide permiso y se suscribe. @returns false si se ha denegado el permiso. */
  async enable(): Promise<boolean> {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      this.state.set(permission === 'denied' ? 'bloqueado' : 'desactivado');
      return false;
    }
    const registration = await this.registration();
    const { publicKey } = await firstValueFrom(this.http.get<PushConfig>('/api/push/config'));
    const key = base64UrlToBytes(publicKey);
    let sub = await registration.pushManager.getSubscription();
    // Suscripción con otra clave (por ejemplo, de otro servidor): no sirve.
    if (sub && !sameKey(sub.options.applicationServerKey, key)) {
      await sub.unsubscribe();
      sub = null;
    }
    sub ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await this.save(sub);
    this.state.set('activado');
    return true;
  }

  async disable(): Promise<void> {
    await this.forget();
    this.state.set('desactivado');
  }

  /** Manda un aviso de prueba a todos los dispositivos de la cuenta. @returns a cuántos ha llegado. */
  async test(): Promise<number> {
    const { sent } = await firstValueFrom(this.http.post<{ sent: number }>('/api/push/test', {}));
    return sent;
  }

  /**
   * Quita los avisos de este dispositivo, en el servidor y en el navegador. Se llama también al
   * cerrar sesión, para que quien entre después en este navegador no reciba los avisos de otro.
   */
  async forget(): Promise<void> {
    if (!this.supported) return;
    const sub = await this.subscription();
    if (!sub) return;
    try {
      await firstValueFrom(this.http.delete('/api/push/subscriptions', { body: { endpoint: sub.endpoint } }));
    } finally {
      await sub.unsubscribe();
    }
  }

  private async subscription(): Promise<PushSubscription | null> {
    const registration = await navigator.serviceWorker.getRegistration();
    return (await registration?.pushManager.getSubscription()) ?? null;
  }

  private async registration(): Promise<ServiceWorkerRegistration> {
    await navigator.serviceWorker.register('/sw.js');
    return navigator.serviceWorker.ready;
  }

  private async save(sub: PushSubscription): Promise<void> {
    await firstValueFrom(this.http.post('/api/push/subscriptions', sub.toJSON()));
  }
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function sameKey(current: ArrayBuffer | null, key: Uint8Array): boolean {
  if (!current) return false;
  const a = new Uint8Array(current);
  return a.length === key.length && a.every((b, i) => b === key[i]);
}
