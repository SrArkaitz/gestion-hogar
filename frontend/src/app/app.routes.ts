import { Routes } from '@angular/router';
import { authGuard, guestGuard, householdGuard } from './core/guards';
import { Shell } from './layout/shell';

export const routes: Routes = [
  // Sin sesión
  { path: 'entrar', canActivate: [guestGuard], title: 'Entrar · Hogar', loadComponent: () => import('./auth/login.page').then((m) => m.LoginPage) },
  { path: 'registro', canActivate: [guestGuard], title: 'Crear cuenta · Hogar', loadComponent: () => import('./auth/register.page').then((m) => m.RegisterPage) },
  // Con o sin sesión: la página explica qué hacer en cada caso
  { path: 'invitacion/:token', title: 'Invitación · Hogar', loadComponent: () => import('./households/invitation.page').then((m) => m.InvitationPage) },
  // Con sesión pero aún sin casa
  { path: 'bienvenida', canActivate: [authGuard], title: 'Bienvenida · Hogar', loadComponent: () => import('./households/welcome.page').then((m) => m.WelcomePage) },

  // La app: sesión y al menos una casa. Cada módulo tiene sus propias rutas y se carga al entrar en él.
  {
    path: '',
    component: Shell,
    canActivate: [authGuard, householdGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tareas' },
      { path: 'tareas', loadChildren: () => import('./tasks/tasks.routes').then((m) => m.TASKS_ROUTES) },
      { path: 'ideas', loadChildren: () => import('./ideas/ideas.routes').then((m) => m.IDEAS_ROUTES) },
      { path: 'recetas', loadChildren: () => import('./recipes/recipes.routes').then((m) => m.RECIPES_ROUTES) },
      { path: 'compra', title: 'Compra · Hogar', loadComponent: () => import('./shopping/shopping.page').then((m) => m.ShoppingPage) },
      { path: 'casa', title: 'Casa · Hogar', loadComponent: () => import('./households/household.page').then((m) => m.HouseholdPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
