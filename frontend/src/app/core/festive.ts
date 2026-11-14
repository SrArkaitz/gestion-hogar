import { Component, computed, inject, input } from '@angular/core';
import { HolidayKey } from '@hogar/shared';
import { FestiveService } from './festive.service';
import { SessionService } from './session.service';

/** Dibujo de una fiesta (colores fijos: se ven igual en claro y en oscuro). */
@Component({
  selector: 'app-festive-icon',
  host: { class: 'festive-icon' },
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      @switch (kind()) {
        @case ('globos') {
          <path d="M7 12.6q1.4 5 5 9.8M17 11.6q-1.6 5.6-5 10.8M12 16v6.4" fill="none" stroke="#64748b" stroke-width=".8" />
          <ellipse cx="7" cy="7.4" rx="4.4" ry="5.4" fill="#ef4444" />
          <ellipse cx="17" cy="6.4" rx="4.4" ry="5.4" fill="#3b82f6" />
          <ellipse cx="12" cy="10.4" rx="4.4" ry="5.4" fill="#facc15" />
          <ellipse cx="5.6" cy="5.4" rx="1" ry="1.6" fill="#fecaca" /><ellipse cx="15.6" cy="4.4" rx="1" ry="1.6" fill="#bfdbfe" /><ellipse cx="10.6" cy="8.4" rx="1" ry="1.6" fill="#fef9c3" />
        }
        @case ('halloween') {
          <path d="M12 7.5c-.3-2.4.6-4 2.6-4.8" fill="none" stroke="#4d7c0f" stroke-width="1.8" stroke-linecap="round" />
          <ellipse cx="7.6" cy="14.3" rx="5" ry="6.8" fill="#ea580c" />
          <ellipse cx="16.4" cy="14.3" rx="5" ry="6.8" fill="#ea580c" />
          <ellipse cx="12" cy="14.3" rx="4.6" ry="7.3" fill="#f97316" />
          <path d="M7.6 12.6l1.6-2.2 1.6 2.2zM13.2 12.6l1.6-2.2 1.6 2.2zM8 16q4 3 8 0l-1.3.4-.7 1-.9-.8-1.1 1-1.1-1-.9.8-.7-1z" fill="#7c2d12" />
        }
        @case ('navidad') {
          <rect x="10.6" y="18.5" width="2.8" height="4" rx=".6" fill="#92400e" />
          <path d="M12 3.4 7.2 9.2h2.4L5.6 14h2.9L4.3 19.4h15.4L15.5 14h2.9l-4-4.8h2.4z" fill="#15803d" />
          <path d="M12 1.2l.8 1.6 1.7.2-1.3 1.2.4 1.7L12 5l-1.6.9.4-1.7-1.3-1.2 1.7-.2z" fill="#facc15" />
          <circle cx="10.4" cy="10.8" r="1" fill="#dc2626" /><circle cx="14" cy="13.4" r="1" fill="#facc15" />
          <circle cx="9.2" cy="16.4" r="1" fill="#38bdf8" /><circle cx="15.2" cy="17.4" r="1" fill="#dc2626" />
        }
        @case ('accion-de-gracias') {
          <circle cx="12" cy="11.5" r="9.2" fill="#dc2626" />
          <circle cx="12" cy="11.5" r="7.2" fill="#f59e0b" />
          <circle cx="12" cy="11.5" r="5.2" fill="#facc15" />
          <path d="M10 20.5v2M14 20.5v2" stroke="#ea580c" stroke-width="1.4" stroke-linecap="round" />
          <ellipse cx="12" cy="15.5" rx="4.6" ry="5.4" fill="#92400e" />
          <circle cx="12" cy="9.4" r="2.6" fill="#a16207" />
          <circle cx="11.1" cy="8.9" r=".45" fill="#1c1917" /><circle cx="12.9" cy="8.9" r=".45" fill="#1c1917" />
          <path d="M11.3 9.9h1.4L12 11z" fill="#f59e0b" />
          <path d="M12.5 10.6q.9 1.2 0 2.2" fill="none" stroke="#dc2626" stroke-width="1" stroke-linecap="round" />
        }
        @case ('pascua') {
          <ellipse cx="12" cy="13" rx="7.2" ry="9.2" fill="#c4b5fd" />
          <path d="M7.6 7.6h8.8" stroke="#60a5fa" stroke-width="1.6" stroke-linecap="round" />
          <path d="M6 12.2l2-1.8 2 1.8 2-1.8 2 1.8 2-1.8 2 1.8" fill="none" stroke="#f472b6" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
          <circle cx="8.8" cy="16.6" r="1.1" fill="#facc15" /><circle cx="12" cy="17.4" r="1.1" fill="#facc15" /><circle cx="15.2" cy="16.6" r="1.1" fill="#facc15" />
        }
        @case ('san-valentin') {
          <path d="M12 21s-8.2-5.2-8.2-11.1a4.6 4.6 0 0 1 8.2-2.9 4.6 4.6 0 0 1 8.2 2.9C20.2 15.8 12 21 12 21z" fill="#e11d48" />
          <ellipse cx="8" cy="9.4" rx="1.4" ry="1" fill="#fecdd3" transform="rotate(-35 8 9.4)" />
        }
        @case ('reyes') {
          <path d="M3.2 17.5 4.4 7.4l4.4 4.4L12 4.6l3.2 7.2 4.4-4.4 1.2 10.1z" fill="#facc15" stroke="#ca8a04" stroke-width=".8" stroke-linejoin="round" />
          <rect x="3.2" y="17.5" width="17.6" height="3.3" rx=".8" fill="#eab308" />
          <circle cx="4.4" cy="6.6" r="1.1" fill="#facc15" /><circle cx="12" cy="3.8" r="1.1" fill="#facc15" /><circle cx="19.6" cy="6.6" r="1.1" fill="#facc15" />
          <circle cx="12" cy="14.2" r="1.4" fill="#dc2626" /><circle cx="7.6" cy="15.2" r="1" fill="#2563eb" /><circle cx="16.4" cy="15.2" r="1" fill="#16a34a" />
        }
        @case ('carnaval') {
          <path d="M18.5 7.8c1.2-2.4 2.8-3.6 4.4-4" fill="none" stroke="#facc15" stroke-width="1.6" stroke-linecap="round" />
          <path fill-rule="evenodd" fill="#a21caf"
                d="M1.8 9.4c3.3-2.3 7.2-2.2 10.2-.2 3-2 6.9-2.1 10.2.2 0 5.2-2.9 8.2-6.2 8.2-2.1 0-3.2-1.8-4-3-.8 1.2-1.9 3-4 3-3.3 0-6.2-3-6.2-8.2zM5.6 11.8a2.3 1.6 0 1 0 4.6 0 2.3 1.6 0 1 0-4.6 0zM13.8 11.8a2.3 1.6 0 1 0 4.6 0 2.3 1.6 0 1 0-4.6 0z" />
          <circle cx="12" cy="16.6" r=".9" fill="#facc15" /><circle cx="3.4" cy="8.2" r=".7" fill="#38bdf8" /><circle cx="20.6" cy="12.6" r=".7" fill="#38bdf8" />
        }
        @case ('san-patricio') {
          <path d="M12 12.5q.6 5 4.2 9" fill="none" stroke="#15803d" stroke-width="1.7" stroke-linecap="round" />
          <g fill="#16a34a">
            <path d="M12 12.3s-4.3-2.7-4.3-5.8a2.3 2.3 0 0 1 4.3-1.3 2.3 2.3 0 0 1 4.3 1.3c0 3.1-4.3 5.8-4.3 5.8z" />
            <path d="M12 12.3s-4.3-2.7-4.3-5.8a2.3 2.3 0 0 1 4.3-1.3 2.3 2.3 0 0 1 4.3 1.3c0 3.1-4.3 5.8-4.3 5.8z" transform="rotate(120 12 12.3)" />
            <path d="M12 12.3s-4.3-2.7-4.3-5.8a2.3 2.3 0 0 1 4.3-1.3 2.3 2.3 0 0 1 4.3 1.3c0 3.1-4.3 5.8-4.3 5.8z" transform="rotate(240 12 12.3)" />
          </g>
          <circle cx="12" cy="12.3" r="1" fill="#15803d" />
        }
        @case ('san-juan') {
          <path d="M12 1.8c1.6 3.6 5.8 5.6 5.8 10.4a5.8 5.8 0 0 1-11.6 0c0-2.6 1.5-4.2 2.6-5.7.2 1.9 1 2.9 2 3.3-.5-3.1.2-5.7 1.2-8z" fill="#ef4444" />
          <path d="M12 8.6c.9 2.1 3.1 3.1 3.1 5.6a3.1 3.1 0 0 1-6.2 0c0-1.4.8-2.4 1.5-3.1.2 1 .7 1.6 1.2 1.8-.2-1.7 0-3 .4-4.3z" fill="#facc15" />
          <path d="M4.8 21l14.4-3.6M4.8 17.4l14.4 3.6" stroke="#92400e" stroke-width="2.4" stroke-linecap="round" />
          <circle cx="5.4" cy="6" r=".8" fill="#f59e0b" /><circle cx="18.8" cy="4.6" r=".7" fill="#f59e0b" /><circle cx="19.6" cy="9.6" r=".6" fill="#ef4444" />
        }
        @case ('san-fermin') {
          <path d="M3.6 4.6q8.4 3.4 16.8 0v2.8q-8.4 3.4-16.8 0z" fill="#b91c1c" />
          <path d="M5.6 8.2q6.4 2.2 12.8 0L12 21.2z" fill="#dc2626" />
          <path d="M11 9.6 8.8 14l2.4-.8zM13 9.6l2.2 4.4-2.4-.8z" fill="#991b1b" />
          <ellipse cx="12" cy="9.2" rx="1.8" ry="1.4" fill="#991b1b" />
        }
        @case ('santiago') {
          <rect x="1" y="1" width="22" height="22" rx="4.5" fill="#1d4ed8" />
          <path d="M12 19.4 4.6 10.6a7.6 7.2 0 0 1 14.8 0z" fill="#facc15" />
          <path d="M12 19.4 6.3 6.4M12 19.4 9 4.2M12 19.4V3.6M12 19.4l3-15.2M12 19.4l5.7-13" stroke="#ca8a04" stroke-width=".9" stroke-linecap="round" />
          <path d="M9.8 19h4.4l-.6 1.9h-3.2z" fill="#facc15" />
        }
        @case ('oktoberfest') {
          <path d="M17 9.6h2a2.4 2.4 0 0 1 2.4 2.4v3.2a2.4 2.4 0 0 1-2.4 2.4h-2" fill="none" stroke="#a16207" stroke-width="1.8" />
          <rect x="4.4" y="7.6" width="12.8" height="14" rx="1.6" fill="#f59e0b" />
          <path d="M7.6 11v7.6M10.8 11v7.6M14 11v7.6" stroke="#fcd34d" stroke-width="1.3" stroke-linecap="round" />
          <path d="M3.8 9.2a2.4 2.4 0 0 1 1.7-3.8 3 3 0 0 1 5.1-1.5 2.8 2.8 0 0 1 4.7.6 2.4 2.4 0 0 1 2.5 3.4v1.3z" fill="#fefce8" stroke="#d6d3d1" stroke-width=".6" />
        }
        @case ('sant-jordi') {
          <path d="M12 12.4v9.8" stroke="#15803d" stroke-width="1.6" stroke-linecap="round" />
          <path d="M12 17.4c-2.6-.2-4.1-1.7-4.5-3.5 2.5-.2 4.1.9 4.5 3.5zM12 19.6c2.4-.4 3.8-2 4-3.8-2.3 0-3.7 1.2-4 3.8z" fill="#16a34a" />
          <path d="M6.8 6.4c0 3.7 2.3 6.2 5.2 6.2s5.2-2.5 5.2-6.2c-1.4.8-2.7.6-3.5-.3-.6 1-1 1.3-1.7 1.3s-1.1-.3-1.7-1.3c-.8.9-2.1 1.1-3.5.3z" fill="#dc2626" />
          <path d="M8.5 5.5c.9-2.4 2.3-3.5 3.5-3.5s2.6 1.1 3.5 3.5c-1 .9-2.3 1.2-3.5.7-1.2.5-2.5.2-3.5-.7z" fill="#b91c1c" />
        }
        @case ('dia-de-muertos') {
          <path d="M12 2.4c-4.7 0-8 3.3-8 7.8 0 2.6 1.2 4.4 3 5.4V19a1.2 1.2 0 0 0 1.2 1.2h7.6A1.2 1.2 0 0 0 17 19v-3.4c1.8-1 3-2.8 3-5.4 0-4.5-3.3-7.8-8-7.8z" fill="#f8fafc" stroke="#94a3b8" stroke-width=".7" />
          <circle cx="8.8" cy="10.4" r="2.3" fill="#a855f7" /><circle cx="15.2" cy="10.4" r="2.3" fill="#a855f7" />
          <circle cx="8.8" cy="10.4" r=".9" fill="#fde047" /><circle cx="15.2" cy="10.4" r=".9" fill="#fde047" />
          <path d="M12 12.8l-1 2h2z" fill="#334155" />
          <path d="M8.8 17.1q3.2 1 6.4 0M9.8 17.5v2.2M11.3 17.8v2.2M12.7 17.8v2.2M14.2 17.5v2.2" stroke="#334155" stroke-width=".8" fill="none" />
          <circle cx="12" cy="5.6" r="1.3" fill="#f97316" /><circle cx="12" cy="5.6" r=".5" fill="#fde047" />
          <circle cx="6.4" cy="13.8" r=".7" fill="#22d3ee" /><circle cx="17.6" cy="13.8" r=".7" fill="#22d3ee" />
        }
        @case ('anio-nuevo-chino') {
          <path d="M12 .8v2.4" stroke="#ca8a04" stroke-width="1.2" />
          <rect x="8.8" y="3" width="6.4" height="2" rx=".5" fill="#ca8a04" />
          <ellipse cx="12" cy="11.4" rx="8.2" ry="6.8" fill="#dc2626" />
          <path d="M12 4.6v13.6M8.2 5.5q-2.7 5.9 0 11.8M15.8 5.5q2.7 5.9 0 11.8" stroke="#f59e0b" stroke-width=".9" fill="none" />
          <rect x="8.8" y="17.6" width="6.4" height="2" rx=".5" fill="#ca8a04" />
          <path d="M12 19.6v3.4M10.8 19.8v2.8M13.2 19.8v2.8" stroke="#facc15" stroke-width="1" stroke-linecap="round" />
        }
        @case ('marmota') {
          <circle cx="7.9" cy="7.6" r="1.4" fill="#854d0e" /><circle cx="16.1" cy="7.6" r="1.4" fill="#854d0e" />
          <path d="M6.4 21V12a5.6 5.6 0 0 1 11.2 0v9z" fill="#a16207" />
          <ellipse cx="12" cy="17" rx="3" ry="3.6" fill="#d6a35c" />
          <circle cx="10" cy="10.8" r=".85" fill="#1c1917" /><circle cx="14" cy="10.8" r=".85" fill="#1c1917" />
          <ellipse cx="12" cy="13.2" rx="1.9" ry="1.4" fill="#d6a35c" />
          <circle cx="12" cy="12.6" r=".65" fill="#1c1917" />
          <rect x="11.4" y="14.1" width="1.2" height="1.2" rx=".2" fill="#ffffff" />
          <path d="M2 21q10-3.4 20 0v1.6H2z" fill="#78350f" />
        }
        @case ('star-wars') {
          <g stroke-linecap="round">
            <path d="M6 18 18 4.6" stroke="#3b82f6" stroke-width="3.4" />
            <path d="M6 18 18 4.6" stroke="#bfdbfe" stroke-width="1.2" />
            <path d="M18 18 6 4.6" stroke="#ef4444" stroke-width="3.4" />
            <path d="M18 18 6 4.6" stroke="#fecaca" stroke-width="1.2" />
            <path d="M3.4 21 6.4 17.6M20.6 21l-3-3.4" stroke="#475569" stroke-width="2.6" />
          </g>
        }
        @case ('dia-de-pi') {
          <ellipse cx="12" cy="12.6" rx="9.8" ry="8" fill="#d97706" />
          <ellipse cx="12" cy="12" rx="8" ry="6.2" fill="#fcd34d" />
          <path d="M7.9 9.3h8.2M10.1 9.3v6.6M13.9 9.3v5.6q0 1 1.3 1" stroke="#7c2d12" stroke-width="1.7" stroke-linecap="round" fill="none" />
        }
        @case ('primavera') {
          <path d="M12 14v8" stroke="#16a34a" stroke-width="1.6" stroke-linecap="round" />
          <path d="M12 19.4c2.4-.2 3.9-1.6 4.2-3.5-2.4 0-3.8 1.2-4.2 3.5z" fill="#22c55e" />
          <g fill="#f472b6">
            <circle cx="12" cy="4.6" r="3.1" /><circle cx="16.1" cy="7.6" r="3.1" /><circle cx="14.5" cy="12.4" r="3.1" />
            <circle cx="9.5" cy="12.4" r="3.1" /><circle cx="7.9" cy="7.6" r="3.1" />
          </g>
          <circle cx="12" cy="8.6" r="2.5" fill="#facc15" />
        }
        @case ('verano') {
          <g stroke="#f59e0b" stroke-width="1.9" stroke-linecap="round">
            <path d="M12 1.6v2.8M12 19.6v2.8M1.6 12h2.8M19.6 12h2.8M4.6 4.6l2 2M17.4 17.4l2 2M4.6 19.4l2-2M17.4 6.6l2-2" />
          </g>
          <circle cx="12" cy="12" r="5.4" fill="#facc15" />
        }
        @case ('otono') {
          <path d="M19.6 4.4C11 4 5 8.6 5 15.1c0 2 .6 3.6 1.5 4.6 6.6.2 13.4-4.8 13.1-15.3z" fill="#ea580c" />
          <path d="M3.4 21.6 15.2 9.4M9.6 15.2l-.6-3.4M12.4 12.4l3 .6" stroke="#9a3412" stroke-width="1.2" stroke-linecap="round" />
          <path d="M19.8 13.6c-2.6.2-4.2 1.9-4.4 4.6 2.6-.1 4.2-1.8 4.4-4.6z" fill="#facc15" />
        }
        @case ('invierno') {
          <g stroke="#0ea5e9" stroke-width="1.7" stroke-linecap="round" fill="none"><path d="M12 2.6V12M9.7 4.6 12 6.9l2.3-2.3" /><g transform="rotate(60 12 12)"><path d="M12 2.6V12M9.7 4.6 12 6.9l2.3-2.3" /></g><g transform="rotate(120 12 12)"><path d="M12 2.6V12M9.7 4.6 12 6.9l2.3-2.3" /></g><g transform="rotate(180 12 12)"><path d="M12 2.6V12M9.7 4.6 12 6.9l2.3-2.3" /></g><g transform="rotate(240 12 12)"><path d="M12 2.6V12M9.7 4.6 12 6.9l2.3-2.3" /></g><g transform="rotate(300 12 12)"><path d="M12 2.6V12M9.7 4.6 12 6.9l2.3-2.3" /></g></g>
          <circle cx="12" cy="12" r="1.3" fill="#0ea5e9" />
        }
        @case ('anio-nuevo') {
          <g stroke-width="1.8" stroke-linecap="round">
            <path d="M12 9V3M12 15v6" stroke="#facc15" />
            <path d="M9 12H3M15 12h6" stroke="#f43f5e" />
            <path d="M9.9 9.9 5.6 5.6M14.1 14.1l4.3 4.3" stroke="#38bdf8" />
            <path d="M14.1 9.9l4.3-4.3M9.9 14.1l-4.3 4.3" stroke="#a3e635" />
          </g>
          <circle cx="12" cy="12" r="1.4" fill="#f59e0b" />
        }
      }
    </svg>
  `,
})
export class FestiveIcon {
  /** Una fiesta, o "globos" (cumpleaños). */
  readonly kind = input.required<HolidayKey | 'globos'>();
}

/** Adorno de la fiesta de estos días junto al nombre de la app (nada si no hay fiesta o se han quitado). */
@Component({
  selector: 'app-festive',
  imports: [FestiveIcon],
  template: `
    @if (birthday(); as greeting) {
      <span class="festive" role="img" [attr.aria-label]="greeting" [title]="greeting" data-h="globos">
        <app-festive-icon kind="globos" />
      </span>
    } @else if (festive.holiday(); as h) {
      <span class="festive" role="img" [attr.aria-label]="h.greeting" [title]="h.greeting" [attr.data-h]="h.key">
        <app-festive-icon [kind]="h.key" />
      </span>
    }
  `,
})
export class Festive {
  protected readonly festive = inject(FestiveService);
  private readonly session = inject(SessionService);

  /** Saludo si hoy es tu cumpleaños (va antes que la fiesta del día). */
  protected readonly birthday = computed(() => {
    const me = this.session.me();
    if (!me || !this.festive.isBirthday(me.birthday)) return null;
    return `¡Feliz cumpleaños, ${me.user.name.split(' ')[0]}!`;
  });
}
