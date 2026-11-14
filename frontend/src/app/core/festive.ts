import { Component, computed, inject, input } from '@angular/core';
import { HolidayKey } from '@hogar/shared';
import { FestiveService } from './festive.service';
import { SessionService } from './session.service';

/**
 * Dibujo de una fiesta. Todos con el estilo de los globos: formas planas y redondeadas, colores
 * vivos sin bordes ni brillos, y las líneas finas y grises como sus hilos. Colores fijos: se ven
 * igual en claro y en oscuro.
 */
@Component({
  selector: 'app-festive-icon',
  host: { class: 'festive-icon' },
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      @switch (kind()) {
        @case ('globos') {
          <!-- El mismo dibujo que los globos de la foto (styles.css, .avatar.balloons) -->
          <g transform="translate(2.75 0) scale(.923)">
            <path d="M5.6 11.6q1 6 4.4 13.6M14.4 10.6q-1 7-4.4 14.6M10 14.6v10.6" fill="none" stroke="#64748b" stroke-width=".7" />
            <ellipse cx="5.6" cy="6.6" rx="4" ry="5" fill="#ef4444" />
            <ellipse cx="14.4" cy="5.6" rx="4" ry="5" fill="#3b82f6" />
            <ellipse cx="10" cy="9.6" rx="4" ry="5" fill="#facc15" />
          </g>
        }
        @case ('halloween') {
          <path d="M12 7.6V4" stroke="#64748b" stroke-width=".9" stroke-linecap="round" />
          <ellipse cx="14.6" cy="4.6" rx="2.2" ry="1.1" fill="#22c55e" transform="rotate(-20 14.6 4.6)" />
          <ellipse cx="8" cy="14.4" rx="5" ry="6.6" fill="#f97316" />
          <ellipse cx="16" cy="14.4" rx="5" ry="6.6" fill="#f97316" />
          <ellipse cx="12" cy="14.4" rx="4.4" ry="7" fill="#fb923c" />
          <path d="M7.4 13.2l1.8-2.6 1.8 2.6zM13 13.2l1.8-2.6 1.8 2.6zM7.6 16.2q4.4 3.4 8.8 0l-1.6.4-.8 1.1-1-.9-1 1-1-1-1 .9-.8-1.1z" fill="#9a3412" />
        }
        @case ('navidad') {
          <path d="M12 20v2.6" stroke="#a16207" stroke-width="2.2" stroke-linecap="round" />
          <path d="M12 3.4 6.6 10h2.6L5 15.4h3l-4 5.2h16l-4-5.2h3L14.8 10h2.6z" fill="#22c55e" />
          <circle cx="12" cy="3" r="1.7" fill="#facc15" />
          <circle cx="10" cy="11.8" r="1.1" fill="#ef4444" /><circle cx="14.2" cy="15.4" r="1.1" fill="#3b82f6" /><circle cx="9.4" cy="18" r="1.1" fill="#facc15" />
        }
        @case ('accion-de-gracias') {
          <ellipse cx="6.8" cy="9.4" rx="3.2" ry="5.4" fill="#ef4444" transform="rotate(-35 6.8 9.4)" />
          <ellipse cx="17.2" cy="9.4" rx="3.2" ry="5.4" fill="#f97316" transform="rotate(35 17.2 9.4)" />
          <ellipse cx="12" cy="6.6" rx="3.2" ry="5.4" fill="#facc15" />
          <path d="M10.4 20v2.8M13.6 20v2.8" stroke="#64748b" stroke-width=".9" stroke-linecap="round" />
          <ellipse cx="12" cy="15" rx="5" ry="5.8" fill="#a16207" />
          <circle cx="12" cy="9.8" r="2.4" fill="#ca8a04" />
          <path d="M12.8 10.2l1.6.6-1.6.7z" fill="#f97316" />
        }
        @case ('pascua') {
          <path d="M5 14.2q7-12 14 0" fill="none" stroke="#64748b" stroke-width=".9" />
          <ellipse cx="7.6" cy="11.8" rx="3.2" ry="4.2" fill="#ec4899" />
          <ellipse cx="16.4" cy="11.8" rx="3.2" ry="4.2" fill="#3b82f6" />
          <ellipse cx="12" cy="10" rx="3.2" ry="4.2" fill="#facc15" />
          <path d="M3 14h18l-2.2 7.4H5.2z" fill="#a16207" />
        }
        @case ('san-valentin') {
          <path d="M12 16.6q-1.4 3 .4 6.6" fill="none" stroke="#64748b" stroke-width=".7" />
          <path d="M12 16.8s-7.4-4.5-7.4-9.8a4.1 4.1 0 0 1 7.4-2.5 4.1 4.1 0 0 1 7.4 2.5c0 5.3-7.4 9.8-7.4 9.8z" fill="#ef4444" />
        }
        @case ('reyes') {
          <path d="M3.5 18 4.6 7.6l4.4 4.2L12 4.6l3 7.2 4.4-4.2L20.5 18z" fill="#facc15" />
          <rect x="3.5" y="18" width="17" height="3" rx=".8" fill="#eab308" />
          <circle cx="12" cy="14.6" r="1.4" fill="#ef4444" /><circle cx="7.6" cy="15.4" r="1.1" fill="#3b82f6" /><circle cx="16.4" cy="15.4" r="1.1" fill="#22c55e" />
        }
        @case ('carnaval') {
          <path d="M16.8 16.6l3.6 6" stroke="#64748b" stroke-width=".9" stroke-linecap="round" />
          <ellipse cx="4.2" cy="5.6" rx="1.4" ry="3.2" fill="#ec4899" transform="rotate(-25 4.2 5.6)" />
          <path fill-rule="evenodd" fill="#a855f7"
                d="M1.8 9.4c3.3-2.3 7.2-2.2 10.2-.2 3-2 6.9-2.1 10.2.2 0 5.2-2.9 8.2-6.2 8.2-2.1 0-3.2-1.8-4-3-.8 1.2-1.9 3-4 3-3.3 0-6.2-3-6.2-8.2zM5.6 11.8a2.3 1.6 0 1 0 4.6 0 2.3 1.6 0 1 0-4.6 0zM13.8 11.8a2.3 1.6 0 1 0 4.6 0 2.3 1.6 0 1 0-4.6 0z" />
        }
        @case ('san-patricio') {
          <path d="M12 13q.6 5.4 4 9.4" fill="none" stroke="#64748b" stroke-width=".9" stroke-linecap="round" />
          <circle cx="12" cy="7.4" r="3.6" fill="#22c55e" />
          <circle cx="7.6" cy="13" r="3.6" fill="#16a34a" />
          <circle cx="16.4" cy="13" r="3.6" fill="#4ade80" />
        }
        @case ('san-juan') {
          <path d="M12 2c1.6 3.6 5.8 5.6 5.8 10.4a5.8 5.8 0 0 1-11.6 0c0-2.6 1.5-4.2 2.6-5.7.2 1.9 1 2.9 2 3.3-.5-3.1.2-5.7 1.2-8z" fill="#ef4444" />
          <path d="M12 8.8c.9 2.1 3.1 3.1 3.1 5.6a3.1 3.1 0 0 1-6.2 0c0-1.4.8-2.4 1.5-3.1.2 1 .7 1.6 1.2 1.8-.2-1.7 0-3 .4-4.3z" fill="#facc15" />
          <path d="M5 21.2l14-3.4M5 17.8l14 3.4" stroke="#a16207" stroke-width="2.2" stroke-linecap="round" />
        }
        @case ('san-fermin') {
          <path d="M3.6 4.6q8.4 3.4 16.8 0v2.8q-8.4 3.4-16.8 0z" fill="#dc2626" />
          <path d="M5.6 8.2q6.4 2.2 12.8 0L12 21.2z" fill="#ef4444" />
          <ellipse cx="12" cy="9.2" rx="1.8" ry="1.4" fill="#b91c1c" />
        }
        @case ('santiago') {
          <rect x="1" y="1" width="22" height="22" rx="5" fill="#3b82f6" />
          <g transform="translate(12 12) scale(.8) translate(-12 -12.6)">
            <path d="M12 21 3.4 10.6a8.8 8.2 0 0 1 17.2 0z" fill="#facc15" />
            <path d="M12 21 5.4 5.6M12 21 8.6 3.6M12 21V2.8M12 21l3.4-17.4M12 21l6.6-15.4" stroke="#ca8a04" stroke-width=".9" stroke-linecap="round" />
            <path d="M9.4 20.4h5.2l-.7 2.2h-3.8z" fill="#facc15" />
          </g>
        }
        @case ('oktoberfest') {
          <path d="M17 10.2h2a2.4 2.4 0 0 1 2.4 2.4v3a2.4 2.4 0 0 1-2.4 2.4h-2" fill="none" stroke="#f59e0b" stroke-width="1.8" />
          <rect x="4.4" y="8.2" width="12.8" height="13.6" rx="1.6" fill="#f59e0b" />
          <circle cx="6.8" cy="8" r="2.6" fill="#fde68a" /><circle cx="10.8" cy="6.8" r="3" fill="#fde68a" /><circle cx="14.8" cy="8" r="2.6" fill="#fde68a" />
        }
        @case ('sant-jordi') {
          <path d="M12 11.6v10.6" stroke="#64748b" stroke-width=".9" stroke-linecap="round" />
          <ellipse cx="9" cy="16.6" rx="2.8" ry="1.4" fill="#22c55e" transform="rotate(25 9 16.6)" />
          <ellipse cx="15" cy="18.6" rx="2.8" ry="1.4" fill="#22c55e" transform="rotate(-25 15 18.6)" />
          <circle cx="12" cy="7.4" r="5" fill="#ef4444" />
          <path d="M9 6.8q3-3 6 0-3 2.6-6 0z" fill="#dc2626" />
        }
        @case ('dia-de-muertos') {
          <path d="M12 2.6c-4.6 0-7.8 3.2-7.8 7.6 0 2.6 1.2 4.4 2.9 5.4V19a1.2 1.2 0 0 0 1.2 1.2h7.4a1.2 1.2 0 0 0 1.2-1.2v-3.4c1.7-1 2.9-2.8 2.9-5.4 0-4.4-3.2-7.6-7.8-7.6z" fill="#e2e8f0" />
          <circle cx="8.9" cy="10.4" r="2.2" fill="#a855f7" /><circle cx="15.1" cy="10.4" r="2.2" fill="#ec4899" />
          <path d="M12 12.8l-.9 1.8h1.8z" fill="#64748b" />
          <path d="M9 17.2h6M10.5 16.2v2M12 16.2v2M13.5 16.2v2" stroke="#64748b" stroke-width=".7" stroke-linecap="round" />
          <circle cx="12" cy="5.6" r="1.3" fill="#f97316" />
        }
        @case ('anio-nuevo-chino') {
          <path d="M12 .8v2.4" stroke="#64748b" stroke-width=".7" />
          <path d="M10.9 19.8v2.8M13.1 19.8v2.8" stroke="#facc15" stroke-width="1" stroke-linecap="round" />
          <rect x="8.8" y="3" width="6.4" height="2" rx=".5" fill="#facc15" />
          <ellipse cx="12" cy="11.4" rx="8.2" ry="6.8" fill="#ef4444" />
          <path d="M12 4.8v13.2M8.3 5.6q-2.6 5.8 0 11.6M15.7 5.6q2.6 5.8 0 11.6" stroke="#dc2626" stroke-width=".8" fill="none" />
          <rect x="8.8" y="17.6" width="6.4" height="2" rx=".5" fill="#facc15" />
        }
        @case ('marmota') {
          <circle cx="7.9" cy="7.6" r="1.4" fill="#a16207" /><circle cx="16.1" cy="7.6" r="1.4" fill="#a16207" />
          <path d="M6.4 21V12a5.6 5.6 0 0 1 11.2 0v9z" fill="#ca8a04" />
          <ellipse cx="12" cy="17" rx="3" ry="3.6" fill="#fde68a" />
          <circle cx="10" cy="10.8" r=".8" fill="#334155" /><circle cx="14" cy="10.8" r=".8" fill="#334155" />
          <ellipse cx="12" cy="13" rx="1.6" ry="1.2" fill="#fde68a" />
          <path d="M2 21q10-3.4 20 0v1.6H2z" fill="#a16207" />
        }
        @case ('star-wars') {
          <path d="M6.2 17.8 18 4.6" stroke="#3b82f6" stroke-width="2.2" stroke-linecap="round" />
          <path d="M17.8 17.8 6 4.6" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" />
          <path d="M3.8 20.6 6.4 17.6M20.2 20.6l-2.6-3" stroke="#64748b" stroke-width="2.4" stroke-linecap="round" />
        }
        @case ('dia-de-pi') {
          <ellipse cx="12" cy="12.6" rx="9.6" ry="7.8" fill="#f59e0b" />
          <ellipse cx="12" cy="12" rx="7.8" ry="6" fill="#fde68a" />
          <path d="M8 9.4h8M10.1 9.4v6.4M13.9 9.4v5.4q0 1 1.2 1" stroke="#a16207" stroke-width="1.5" stroke-linecap="round" fill="none" />
        }
        @case ('primavera') {
          <path d="M12 12v10.4" stroke="#64748b" stroke-width=".9" stroke-linecap="round" />
          <ellipse cx="15" cy="18.2" rx="2.6" ry="1.3" fill="#22c55e" transform="rotate(-30 15 18.2)" />
          <g fill="#ec4899">
            <circle cx="12" cy="4.4" r="3" /><circle cx="15.6" cy="7" r="3" /><circle cx="14.3" cy="11.2" r="3" />
            <circle cx="9.7" cy="11.2" r="3" /><circle cx="8.4" cy="7" r="3" />
          </g>
          <circle cx="12" cy="8.2" r="2.4" fill="#facc15" />
        }
        @case ('verano') {
          <path d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6M4.8 4.8l1.8 1.8M17.4 17.4l1.8 1.8M4.8 19.2l1.8-1.8M17.4 6.6l1.8-1.8" stroke="#f97316" stroke-width="1.6" stroke-linecap="round" />
          <circle cx="12" cy="12" r="5.6" fill="#facc15" />
        }
        @case ('otono') {
          <g transform="rotate(30 12 12)">
            <path d="M12 18.6v4" stroke="#64748b" stroke-width=".9" stroke-linecap="round" />
            <path d="M12 1.6c5.2 3.8 5.2 13.2 0 17-5.2-3.8-5.2-13.2 0-17z" fill="#a16207" />
            <path d="M12 4.4v14M12 8.4l2.4-1.8M12 8.4 9.6 6.6M12 12l2.8-2M12 12 9.2 10M12 15.4l2.4-1.6M12 15.4l-2.4-1.6" stroke="#78350f" stroke-width=".7" stroke-linecap="round" fill="none" />
          </g>
        }
        @case ('invierno') {
          <g stroke="#3b82f6" stroke-width="1.4" stroke-linecap="round" fill="none">
            <path d="M12 2.6V12M9.7 4.6 12 6.9l2.3-2.3" />
            <path d="M12 2.6V12M9.7 4.6 12 6.9l2.3-2.3" transform="rotate(60 12 12)" />
            <path d="M12 2.6V12M9.7 4.6 12 6.9l2.3-2.3" transform="rotate(120 12 12)" />
            <path d="M12 2.6V12M9.7 4.6 12 6.9l2.3-2.3" transform="rotate(180 12 12)" />
            <path d="M12 2.6V12M9.7 4.6 12 6.9l2.3-2.3" transform="rotate(240 12 12)" />
            <path d="M12 2.6V12M9.7 4.6 12 6.9l2.3-2.3" transform="rotate(300 12 12)" />
          </g>
        }
        @case ('inocentes') {
          <rect x="10" y="1" width="4" height="1.8" rx=".3" fill="#fde68a" transform="rotate(-8 12 1.9)" />
          <circle cx="12" cy="5.6" r="3" fill="#cbd5e1" />
          <path d="M8.6 9.2h6.8l3.6 4.4-1.6 1.2-2.4-2.4v4l1.8 6h-2.4L12 17 9.6 22.4H7.2l1.8-6v-4l-2.4 2.4L5 13.6z" fill="#cbd5e1" />
        }
        @case ('dia-del-gato') {
          <path d="M4.6 9.4 5.2 2.8l5 4.2zM19.4 9.4l-.6-6.6-5 4.2z" fill="#f97316" />
          <ellipse cx="12" cy="13.6" rx="8.4" ry="7.4" fill="#f97316" />
          <path d="M12 6.6v3M9.4 7l.6 2.4M14.6 7l-.6 2.4" stroke="#ea580c" stroke-width="1.2" stroke-linecap="round" />
          <ellipse cx="8.8" cy="12.8" rx="1" ry="1.4" fill="#334155" /><ellipse cx="15.2" cy="12.8" rx="1" ry="1.4" fill="#334155" />
          <path d="M11 15.4h2L12 16.6z" fill="#ec4899" />
          <path d="M2.8 15.2l4.2.6M3.2 18l4-.8M21.2 15.2l-4.2.6M20.8 18l-4-.8" stroke="#64748b" stroke-width=".6" stroke-linecap="round" />
        }
        @case ('dia-del-perro') {
          <ellipse cx="5.6" cy="10.8" rx="2.8" ry="5.4" fill="#a16207" transform="rotate(20 5.6 10.8)" />
          <ellipse cx="18.4" cy="10.8" rx="2.8" ry="5.4" fill="#a16207" transform="rotate(-20 18.4 10.8)" />
          <ellipse cx="12" cy="12.4" rx="6.6" ry="7.8" fill="#fde68a" />
          <ellipse cx="14.8" cy="10" rx="2.2" ry="2" fill="#ca8a04" />
          <circle cx="9.4" cy="10.8" r=".9" fill="#334155" /><circle cx="14.6" cy="10.8" r=".9" fill="#334155" />
          <ellipse cx="12" cy="14.4" rx="1.6" ry="1.1" fill="#334155" />
          <ellipse cx="12" cy="18.4" rx="1" ry="1.3" fill="#ef4444" />
          <path d="M12 15.5v1.6M10.4 17q1.6 1 3.2 0" stroke="#64748b" stroke-width=".7" fill="none" stroke-linecap="round" />
        }
        @case ('dia-del-chocolate') {
          <rect x="5" y="2.4" width="14" height="19" rx="1.4" fill="#78350f" />
          <path d="M5 8.4h14M12 2.4v11.2" stroke="#451a03" stroke-width=".8" />
          <path d="M4.4 13.6h15.2v8.2a1 1 0 0 1-1 1H5.4a1 1 0 0 1-1-1z" fill="#ef4444" />
          <path d="M4.4 17.8h15.2" stroke="#facc15" stroke-width="1.2" />
        }
        @case ('bisiesto') {
          <ellipse cx="5" cy="18.8" rx="3" ry="1.4" fill="#16a34a" /><ellipse cx="19" cy="18.8" rx="3" ry="1.4" fill="#16a34a" />
          <ellipse cx="12" cy="14.2" rx="7.4" ry="5.4" fill="#22c55e" />
          <circle cx="8.4" cy="9.2" r="2.6" fill="#22c55e" /><circle cx="15.6" cy="9.2" r="2.6" fill="#22c55e" />
          <circle cx="8.4" cy="8.8" r="1" fill="#334155" /><circle cx="15.6" cy="8.8" r="1" fill="#334155" />
          <ellipse cx="12" cy="15.8" rx="4" ry="2.6" fill="#86efac" />
          <path d="M9.4 12.6q2.6 1.6 5.2 0" stroke="#15803d" stroke-width=".8" fill="none" stroke-linecap="round" />
        }
        @case ('orgullo-friki') {
          <path d="M12 2l8.7 5v10L12 22l-8.7-5V7z" fill="#a855f7" />
          <path d="M12 6.4l5.4 9.2H6.6z" fill="#c084fc" />
          <path d="M12 2v4.4M3.3 7 12 6.4l8.7.6M3.3 7l3.3 8.6M20.7 7l-3.3 8.6M3.3 17l3.3-1.4M20.7 17l-3.3-1.4M12 22l-5.4-6.4M12 22l5.4-6.4" stroke="#7e22ce" stroke-width=".6" fill="none" stroke-linejoin="round" />
          <text x="12" y="13.9" text-anchor="middle" font-size="4.4" font-weight="700" font-family="sans-serif" fill="#ffffff">20</text>
        }
        @case ('viernes-13') {
          <path d="M16.6 20.8q4.8-.4 3.8-6" stroke="#334155" stroke-width="1.6" fill="none" stroke-linecap="round" />
          <ellipse cx="12" cy="17.4" rx="5.4" ry="5" fill="#334155" />
          <path d="M7.6 8.6 8 3.2l3.2 2.8zM16.4 8.6 16 3.2l-3.2 2.8z" fill="#334155" />
          <circle cx="12" cy="9.2" r="4.6" fill="#334155" />
          <ellipse cx="10.3" cy="9" rx=".9" ry="1.2" fill="#facc15" /><ellipse cx="13.7" cy="9" rx=".9" ry="1.2" fill="#facc15" />
        }
        @case ('pokemon') {
          <path d="M2.4 12a9.6 9.6 0 0 1 19.2 0z" fill="#ef4444" />
          <path d="M2.4 12a9.6 9.6 0 0 0 19.2 0z" fill="#e2e8f0" />
          <path d="M2.4 12h19.2" stroke="#334155" stroke-width="1.6" />
          <circle cx="12" cy="12" r="3.2" fill="#334155" /><circle cx="12" cy="12" r="1.8" fill="#f8fafc" />
        }
        @case ('mario') {
          <rect x="7" y="11.4" width="10" height="10.2" rx="3.4" fill="#fde68a" />
          <path d="M2.4 13.2a9.6 9 0 0 1 19.2 0z" fill="#ef4444" />
          <circle cx="12" cy="6.8" r="2.4" fill="#f8fafc" /><circle cx="5.8" cy="11" r="1.6" fill="#f8fafc" /><circle cx="18.2" cy="11" r="1.6" fill="#f8fafc" />
          <ellipse cx="10.2" cy="16.4" rx=".7" ry="1.3" fill="#334155" /><ellipse cx="13.8" cy="16.4" rx=".7" ry="1.3" fill="#334155" />
        }
        @case ('anio-nuevo') {
          <g stroke-width="1.6" stroke-linecap="round">
            <path d="M12 8.6V3.4M12 15.4v5.2" stroke="#facc15" />
            <path d="M8.6 12H3.4M15.4 12h5.2" stroke="#ef4444" />
            <path d="M9.6 9.6 5.9 5.9M14.4 14.4l3.7 3.7" stroke="#3b82f6" />
            <path d="M14.4 9.6l3.7-3.7M9.6 14.4l-3.7 3.7" stroke="#ec4899" />
          </g>
          <circle cx="12" cy="12" r="1.4" fill="#facc15" />
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
