import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas de la sección: recetario y menú semanal. */
@Component({
  selector: 'app-recipes-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="tabs" aria-label="Recetas">
      <a routerLink="/recetas" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Recetario</a>
      <a routerLink="/recetas/menu" routerLinkActive="active" ariaCurrentWhenActive="page">Menú semanal</a>
    </nav>
  `,
})
export class RecipesTabs {}
