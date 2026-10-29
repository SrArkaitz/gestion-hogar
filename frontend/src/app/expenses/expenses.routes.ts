import { Routes } from '@angular/router';
import { BillsPage } from './bills.page';
import { ExpensesPage } from './expenses.page';
import { SummaryPage } from './summary.page';

export const EXPENSES_ROUTES: Routes = [
  { path: '', component: ExpensesPage, title: 'Gastos · Hogar' },
  { path: 'facturas', component: BillsPage, title: 'Facturas · Hogar' },
  { path: 'resumen', component: SummaryPage, title: 'Resumen de gastos · Hogar' },
];
