import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SessionService } from '../core/session.service';

/** Pestañas de Tareas: las personales (solo tuyas), las del hogar (de todos) y las ideas. */
@Component({
  selector: 'app-tasks-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="tabs" aria-label="Tareas">
      @if (session.uses('tareas')) {
        <a routerLink="/tareas" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Personales</a>
        <a routerLink="/tareas/hogar" routerLinkActive="active" ariaCurrentWhenActive="page">Del hogar</a>
      }
      @if (session.uses('ideas')) {
        <a routerLink="/tareas/ideas" routerLinkActive="active" ariaCurrentWhenActive="page">Ideas</a>
      }
    </nav>
  `,
})
export class TasksTabs {
  protected readonly session = inject(SessionService);
}
