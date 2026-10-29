import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas de la sección: gastos y saldos, facturas fijas y resumen del mes. */
@Component({
  selector: 'app-expenses-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="tabs" aria-label="Gastos">
      <a routerLink="/gastos" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Gastos</a>
      <a routerLink="/gastos/facturas" routerLinkActive="active" ariaCurrentWhenActive="page">Facturas</a>
      <a routerLink="/gastos/resumen" routerLinkActive="active" ariaCurrentWhenActive="page">Resumen</a>
    </nav>
  `,
})
export class ExpensesTabs {}
