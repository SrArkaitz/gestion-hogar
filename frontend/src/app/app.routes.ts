import { Routes } from '@angular/router';

/** Cada módulo de la app tiene sus propias rutas y se carga al entrar en él. */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tareas' },
  { path: 'tareas', loadChildren: () => import('./tasks/tasks.routes').then((m) => m.TASKS_ROUTES) },
  { path: 'ideas', loadChildren: () => import('./ideas/ideas.routes').then((m) => m.IDEAS_ROUTES) },
  { path: '**', redirectTo: 'tareas' },
];
