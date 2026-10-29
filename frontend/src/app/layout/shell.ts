import { Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ModuleKey } from '@hogar/shared';
import { SessionService } from '../core/session.service';
import { HouseholdSwitcher } from './household-switcher';

interface NavItem {
  path: string;
  /** Sección que la casa puede ocultar (los ajustes de Casa no tienen). */
  module?: ModuleKey;
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

  /** Secciones de la app; solo salen las que usa la casa activa. */
  private readonly modules: NavItem[] = [
    { path: '/tareas', module: 'tareas', label: 'Tareas', icon: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9' },
    { path: '/calendario', module: 'calendario', label: 'Calendario', icon: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 2v4M16 2v4' },
    { path: '/ideas', module: 'ideas', label: 'Ideas', icon: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z' },
    { path: '/compra', module: 'compra', label: 'Compra', icon: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H6.2M10 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM18 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0z' },
    { path: '/recetas', module: 'recetas', label: 'Recetas', icon: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 5v16M19 19v2H6M9 7h6' },
    { path: '/gastos', module: 'gastos', label: 'Gastos', icon: 'M3 7a2 2 0 0 1 2-2h14v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14h.01' },
    { path: '/inventario', module: 'inventario', label: 'Inventario', icon: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8' },
    { path: '/mantenimiento', module: 'mantenimiento', label: 'Mantenimiento', icon: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z' },
    { path: '/casa', label: 'Casa', icon: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z' },
  ];

  protected readonly nav = computed(() => this.modules.filter((m) => !m.module || this.session.uses(m.module)));

  /** Huecos de la barra del móvil antes del botón "Más" (si no caben todas). */
  protected readonly mobileSlots = 4;
  /** Hasta cinco caben en la barra; con más, las demás van al menú "Más". */
  protected readonly hasMore = computed(() => this.nav().length > this.mobileSlots + 1);
  protected readonly moreOpen = signal(false);
  private readonly url = signal(this.router.url);
  /** La página actual está en el menú "Más" (para marcar el botón). */
  protected readonly inMore = computed(() =>
    this.hasMore() && this.nav().slice(this.mobileSlots).some((m) => this.url().startsWith(m.path)),
  );

  constructor() {
    // Al navegar se cierra el menú "Más" y se apunta la página para marcar el botón.
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.url.set(e.urlAfterRedirects);
        this.moreOpen.set(false);
      }
    });
    // Si se cambia a una casa que no usa la sección en la que se está (o se oculta), a la primera que sí.
    effect(() => {
      if (!this.session.household()) return;
      const current = this.modules.find((m) => m.module && this.router.url.startsWith(m.path));
      if (current?.module && !this.session.uses(current.module)) this.router.navigateByUrl(this.session.home());
    });
  }

  protected async logout() {
    await this.session.logout();
    this.router.navigate(['/entrar']);
  }
}
