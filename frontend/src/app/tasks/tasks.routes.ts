import { Routes } from '@angular/router';
import { sectionGuard } from '../core/guards';
import { RecurringPage } from './recurring.page';
import { TasksPage } from './tasks.page';

/** Pestañas: Personales (la primera), Del hogar e Ideas. */
export const TASKS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', canActivate: [sectionGuard('tareas')], component: TasksPage, data: { personal: true }, title: 'Tareas personales · Hogar' },
  { path: 'hogar', canActivate: [sectionGuard('tareas')], component: TasksPage, title: 'Tareas del hogar · Hogar' },
  { path: 'personales', redirectTo: '' },
  { path: 'recurrentes', canActivate: [sectionGuard('tareas')], component: RecurringPage, title: 'Tareas recurrentes · Hogar' },
  { path: 'ideas', canActivate: [sectionGuard('ideas')], loadChildren: () => import('../ideas/ideas.routes').then((m) => m.IDEAS_ROUTES) },
];
