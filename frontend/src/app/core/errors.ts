import { HttpErrorResponse } from '@angular/common/http';

/** Mensaje para mostrar al usuario a partir de un error de la API. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'No hay conexión con el servidor. Vuelve a intentarlo.';
    const message = (err.error as { message?: unknown } | null)?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  }
  return fallback;
}

/** Ruta interna a la que volver tras entrar. Ignora cualquier cosa que no empiece por "/". */
export function safeReturnUrl(url: string | undefined | null): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}
