import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas de la sección: lo que hay en casa y los equipos con sus garantías. */
@Component({
  selector: 'app-inventory-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="tabs" aria-label="Inventario">
      <a routerLink="/inventario" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Despensa y casa</a>
      <a routerLink="/inventario/equipos" routerLinkActive="active" ariaCurrentWhenActive="page">Equipos y garantías</a>
    </nav>
  `,
})
export class InventoryTabs {}
