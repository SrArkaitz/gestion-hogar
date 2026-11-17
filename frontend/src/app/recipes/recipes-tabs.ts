import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas de la sección: Mis recetas, el buscador y el menú semanal. */
@Component({
  selector: 'app-recipes-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="tabs" aria-label="Recetas">
      <a routerLink="/recetas" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Mis recetas</a>
      <a routerLink="/recetas/buscar" routerLinkActive="active" ariaCurrentWhenActive="page">Buscar</a>
      <a routerLink="/recetas/menu" routerLinkActive="active" ariaCurrentWhenActive="page">Menú semanal</a>
    </nav>
  `,
})
export class RecipesTabs {}
