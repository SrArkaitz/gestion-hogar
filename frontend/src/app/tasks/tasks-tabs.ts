import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas de Tareas: las del hogar (de todos) y las personales (solo tuyas). */
@Component({
  selector: 'app-tasks-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="tabs" aria-label="Tareas">
      <a routerLink="/tareas" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Del hogar</a>
      <a routerLink="/tareas/personales" routerLinkActive="active" ariaCurrentWhenActive="page">Personales</a>
    </nav>
  `,
})
export class TasksTabs {}
