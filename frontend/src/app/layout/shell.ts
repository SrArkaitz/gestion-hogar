import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../core/session.service';
import { HouseholdSwitcher } from './household-switcher';

interface NavItem {
  path: string;
  label: string;
  /** Trazado SVG del icono (24×24, solo contorno). */
  icon: string;
}

/** Estructura de la app con sesión: navegación y página actual. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, HouseholdSwitcher],
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);

  /** Módulos disponibles. Se irán añadiendo según la hoja de ruta. */
  protected readonly nav: NavItem[] = [
    { path: '/tareas', label: 'Tareas', icon: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9' },
    { path: '/ideas', label: 'Ideas', icon: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z' },
    { path: '/compra', label: 'Compra', icon: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H6.2M10 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM18 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0z' },
    { path: '/recetas', label: 'Recetas', icon: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 5v16M19 19v2H6M9 7h6' },
    { path: '/casa', label: 'Casa', icon: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z' },
  ];

  protected async logout() {
    await this.session.logout();
    this.router.navigate(['/entrar']);
  }
}
