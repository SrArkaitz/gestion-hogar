import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { InstallService } from './core/install.service';
import { ThemeService } from './core/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  // Se crean al arrancar: el tema sigue los cambios del dispositivo y la instalación
  // necesita escuchar desde el principio el aviso del navegador.
  private readonly theme = inject(ThemeService);
  private readonly install = inject(InstallService);
  private readonly router = inject(Router);

  constructor() {
    // Al tocar un aviso con la app abierta, el service worker pide ir a su página (ver public/sw.js).
    navigator.serviceWorker?.addEventListener('message', (event) => {
      if (event.data?.type === 'abrir' && typeof event.data.url === 'string') this.router.navigateByUrl(event.data.url);
    });
  }
}
