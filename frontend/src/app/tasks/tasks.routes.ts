import { Routes } from '@angular/router';
import { RecurringPage } from './recurring.page';
import { TasksPage } from './tasks.page';

export const TASKS_ROUTES: Routes = [
  { path: '', component: TasksPage, title: 'Tareas · Hogar' },
  { path: 'personales', component: TasksPage, data: { personal: true }, title: 'Tareas personales · Hogar' },
  { path: 'recurrentes', component: RecurringPage, title: 'Tareas recurrentes · Hogar' },
];
