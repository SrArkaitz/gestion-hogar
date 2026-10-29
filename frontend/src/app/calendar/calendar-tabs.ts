import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas de la sección: calendario y cumpleaños. */
@Component({
  selector: 'app-calendar-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="tabs" aria-label="Calendario">
      <a routerLink="/calendario" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Calendario</a>
      <a routerLink="/calendario/cumpleanos" routerLinkActive="active" ariaCurrentWhenActive="page">Cumpleaños</a>
    </nav>
  `,
})
export class CalendarTabs {}
