import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { PreloadAllModules, provideRouter, withComponentInputBinding, withPreloading } from '@angular/router';
import { App } from './app/app';
import { routes } from './app/app.routes';
import { sessionExpiredInterceptor } from './app/core/guards';

bootstrapApplication(App, {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch(), withInterceptors([sessionExpiredInterceptor])),
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
  ],
}).catch((err) => console.error(err));

// Service worker: hace instalable la app, recibe los avisos push y guarda lo necesario para la
// compra sin conexión (public/sw.js).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('No se pudo registrar el service worker', err));
}
