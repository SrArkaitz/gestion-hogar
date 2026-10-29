import { Injectable, signal } from '@angular/core';

/** Evento de Chrome, Edge y Android para ofrecer la instalación (aún no está en los tipos de TypeScript). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Instalar la app en el dispositivo (PWA). Chrome, Edge y Android avisan de que se puede con
 * "beforeinstallprompt"; en iPhone y iPad se hace a mano desde Compartir → Añadir a pantalla de inicio.
 * Se crea al arrancar (App) para no perderse ese evento, que llega una sola vez.
 */
@Injectable({ providedIn: 'root' })
export class InstallService {
  private promptEvent: BeforeInstallPromptEvent | null = null;

  /** Ya se está usando como app instalada. */
  readonly installed = signal(
    matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
  );
  /** El navegador ofrece instalarla con un botón. */
  readonly canPrompt = signal(false);
  readonly isIos =
    /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  constructor() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.promptEvent = event as BeforeInstallPromptEvent;
      this.canPrompt.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.promptEvent = null;
      this.canPrompt.set(false);
      this.installed.set(true);
    });
  }

  async install(): Promise<void> {
    const event = this.promptEvent;
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // El navegador solo deja usar el evento una vez.
    this.promptEvent = null;
    this.canPrompt.set(false);
    if (outcome === 'accepted') this.installed.set(true);
  }
}
