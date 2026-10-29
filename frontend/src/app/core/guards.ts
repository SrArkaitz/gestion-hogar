import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionService } from './session.service';

// En los guards, inject() tiene que ir antes de cualquier await: después ya no hay contexto de inyección.

/** Pide sesión iniciada; si no, manda a /entrar y vuelve después. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);
  await session.ensureLoaded();
  if (session.user()) return true;
  return router.createUrlTree(['/entrar'], { queryParams: { volver: state.url } });
};

/** Pide estar en al menos una casa; si no, manda a crear la primera. */
export const householdGuard: CanActivateFn = async () => {
  const session = inject(SessionService);
  const router = inject(Router);
  await session.ensureLoaded();
  // Sin sesión decide authGuard, que va primero.
  if (!session.user()) return true;
  return session.households().length > 0 || router.createUrlTree(['/bienvenida']);
};

/** Para entrar y registrarse: si ya hay sesión, a la app. */
export const guestGuard: CanActivateFn = async () => {
  const session = inject(SessionService);
  const router = inject(Router);
  await session.ensureLoaded();
  return !session.user() || router.createUrlTree(['/']);
};

/** Si la sesión caduca mientras se usa la app, vuelve a la pantalla de entrar. */
export const sessionExpiredInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionService);
  const router = inject(Router);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.startsWith('/api/auth/') && session.user()) {
        session.clear();
        router.navigate(['/entrar'], { queryParams: { volver: router.url } });
      }
      return throwError(() => err);
    }),
  );
};
