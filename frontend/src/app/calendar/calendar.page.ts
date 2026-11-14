import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  addDays,
  CALENDAR_KIND_LABELS,
  CalendarEvent,
  CalendarEventInput,
  CalendarItem,
  CalendarKind,
  IsoDate,
  Member,
  startOfWeek,
  WEEKDAY_INITIALS,
} from '@hogar/shared';
import { monthLabel, monthOf, monthRange, shiftMonth, todayIso } from '../core/dates';
import { errorMessage } from '../core/errors';
import { HouseholdsService } from '../core/households.service';
import { initials } from '../tasks/people';
import { SessionService } from '../core/session.service';
import { CalendarTabs } from './calendar-tabs';
import { CalendarStore } from './calendar.store';
import { EventDialog } from './event-dialog';
import { Avatar } from '../core/avatar';

type View = 'mes' | 'semana';

/** Chips que caben en una casilla del mes (en el PC); el resto, "+N". */
const CHIPS_PER_DAY = 3;

/** El color es de las personas; lo demás va en gris con un icono que dice qué es. */
const KIND_ICONS: Record<CalendarKind, string> = {
  evento: '',
  cumple: '🎂',
  tarea: '✓',
  recurrente: '↻',
  menu: '🍽',
  factura: '€',
  mantenimiento: '🔧',
  garantia: '🛡',
};

/** Persona elegida en el filtro (se recuerda en este navegador). */
const FILTER_KEY = 'hogar.cal.persona';

/**
 * Calendario de la casa: vista de mes (con la lista del día elegido) y de semana. Junta los eventos
 * y cumpleaños con lo que tiene fecha en las demás secciones.
 */
@Component({
  selector: 'app-calendar-page',
  imports: [Avatar, CalendarTabs, EventDialog],
  host: { class: 'view' },
  templateUrl: './calendar.page.html',
})
export class CalendarPage {
  private readonly store = inject(CalendarStore);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly households = inject(HouseholdsService);

  protected readonly kindLabels = CALENDAR_KIND_LABELS;
  protected readonly kindIcons = KIND_ICONS;
  protected readonly weekdayInitials = WEEKDAY_INITIALS;
  protected readonly chipsPerDay = CHIPS_PER_DAY;
  protected readonly today = todayIso();

  protected readonly view = signal<View>('mes');
  protected readonly month = signal(monthOf(this.today));
  protected readonly weekStart = signal(startOfWeek(this.today));
  protected readonly selected = signal<IsoDate>(this.today);

  protected readonly items = signal<CalendarItem[]>([]);
  /** Miembros de la casa: para elegir de quién es un evento y pintar sus iniciales. */
  protected readonly members = signal<Member[]>([]);
  protected readonly initials = initials;
  protected readonly houseIcon = 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z';
  /** Filtro: id de la persona cuyas cosas se ven, o null para todo. */
  protected readonly person = signal<string | null>(readFilter());
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  /** Diálogo de evento: undefined = cerrado, null = nuevo. */
  protected readonly editing = signal<CalendarEvent | null | undefined>(undefined);
  private readonly dialog = viewChild(EventDialog);

  /** Días que se ven: semanas completas de lunes a domingo que cubren el mes, o la semana. */
  protected readonly days = computed<IsoDate[]>(() => {
    if (this.view() === 'semana') return Array.from({ length: 7 }, (_, i) => addDays(this.weekStart(), i));
    const { from, to } = monthRange(this.month());
    const start = startOfWeek(from), end = addDays(startOfWeek(to), 6);
    const days: IsoDate[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    return days;
  });

  /** Lo que se ve con el filtro: lo de esa persona y lo de toda la casa (sin nadie asignado). */
  protected readonly shown = computed(() => {
    const id = this.person();
    if (!id || !this.members().some((m) => m.id === id)) return this.items();
    return this.items().filter((it) => !it.people.length || it.people.includes(id));
  });

  protected readonly byDay = computed(() => {
    const map = new Map<IsoDate, CalendarItem[]>();
    for (const item of this.shown()) map.set(item.date, [...(map.get(item.date) ?? []), item]);
    return map;
  });

  protected readonly title = computed(() => {
    if (this.view() === 'mes') return monthLabel(this.month());
    const start = this.weekStart(), end = addDays(start, 6);
    return `${this.dayText(start, { day: 'numeric', month: 'short' })} – ${this.dayText(end, { day: 'numeric', month: 'short' })}`;
  });

  protected readonly isCurrent = computed(() =>
    this.view() === 'mes' ? this.month() === monthOf(this.today) : this.weekStart() === startOfWeek(this.today),
  );

  constructor() {
    effect(() => {
      const id = this.session.household()?.id;
      const days = this.days();
      if (id) void this.load(days[0], days[days.length - 1]);
    });
    effect(() => {
      const id = this.session.household()?.id;
      if (id) void this.loadMembers(id);
    });
  }

  /**
   * Evento de toda la casa: no se eligió a nadie. Lleva el color de la casa; si se eligieron
   * varias personas (aunque sean todas), sus colores en franjas.
   */
  protected forAll(item: CalendarItem): boolean {
    return item.kind === 'evento' && !item.people.length;
  }

  /** Personas de una cosa del calendario, en el orden de la casa (ninguna si es de toda la casa). */
  protected peopleOf(item: CalendarItem): Member[] {
    if (this.forAll(item)) return [];
    return this.members().filter((m) => item.people.includes(m.id));
  }

  protected setPerson(id: string | null) {
    this.person.set(id);
    try {
      if (id) localStorage.setItem(FILTER_KEY, id);
      else localStorage.removeItem(FILTER_KEY);
    } catch {
      // Sin almacenamiento el filtro vale solo mientras sigues aquí.
    }
  }

  /**
   * Colores de un evento: el de su persona o, si es de varias, los de todas (en franjas). Los de
   * toda la casa llevan el color de la casa (en el CSS). Lo demás (tareas, menú, facturas…) va en
   * gris con su icono.
   */
  protected paint(item: CalendarItem): Record<string, string> | null {
    if (item.kind !== 'evento') return null;
    const colors = this.peopleOf(item).map((m) => `var(--c-${m.color})`);
    if (!colors.length) return { '--kc': 'var(--house)' };
    if (colors.length === 1) return { '--kc': colors[0] };
    const step = 100 / colors.length;
    const bands = colors.map((c, i) => `${c} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`).join(', ');
    const tints = colors.map((c) => `color-mix(in srgb, ${c} 16%, var(--card))`).join(', ');
    return {
      '--kc': colors[0],
      '--stripe': `linear-gradient(to bottom, ${bands})`,
      '--tint': `linear-gradient(90deg, ${tints})`,
    };
  }

  private async loadMembers(id: string) {
    try {
      const household = await this.households.get(id);
      if (this.session.household()?.id === id) this.members.set(household.members);
    } catch {
      // Sin miembros se puede seguir usando el calendario; solo no se eligen personas.
    }
  }

  protected itemsOn(day: IsoDate): CalendarItem[] {
    return this.byDay().get(day) ?? [];
  }

  /**
   * Puntos de un día en el móvil: uno por cada persona con eventos, uno de la casa si hay
   * eventos de todos y uno gris si hay algo más (tareas, menú, facturas…).
   */
  protected dotsOn(day: IsoDate): { key: string; color: string }[] {
    const dots = new Map<string, string>();
    for (const it of this.itemsOn(day)) {
      if (it.kind !== 'evento') dots.set('otro', 'var(--k-other)');
      else if (this.forAll(it)) dots.set('casa', 'var(--house)');
      else for (const m of this.peopleOf(it)) dots.set('p' + m.color, `var(--c-${m.color})`);
    }
    // Primero las personas y la casa; lo gris, al final.
    return [...dots].sort(([a], [b]) => Number(a === 'otro') - Number(b === 'otro')).map(([key, color]) => ({ key, color }));
  }

  protected inMonth(day: IsoDate): boolean {
    return this.view() === 'semana' || monthOf(day) === this.month();
  }

  protected dayText(day: IsoDate, options: Intl.DateTimeFormatOptions): string {
    const text = new Date(day + 'T00:00:00').toLocaleDateString('es-ES', options);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  protected setView(view: View) {
    // Al cambiar de vista se queda en el día elegido.
    this.month.set(monthOf(this.selected()));
    this.weekStart.set(startOfWeek(this.selected()));
    this.view.set(view);
  }

  protected move(delta: number) {
    if (this.view() === 'mes') {
      this.month.update((m) => shiftMonth(m, delta));
      this.selected.set(this.month() === monthOf(this.today) ? this.today : `${this.month()}-01`);
    } else {
      this.weekStart.update((d) => addDays(d, delta * 7));
      this.selected.set(this.weekStart());
    }
  }

  protected goToday() {
    this.month.set(monthOf(this.today));
    this.weekStart.set(startOfWeek(this.today));
    this.selected.set(this.today);
  }

  /** Abre lo que se ha tocado: un evento se edita aquí; lo demás lleva a su sección. */
  protected async open(item: CalendarItem) {
    if (item.kind === 'evento') {
      try {
        this.editing.set(await this.store.event(item.refId));
      } catch (err) {
        this.error.set(errorMessage(err, 'No se pudo abrir el evento.'));
      }
    } else if (item.kind === 'cumple') {
      this.router.navigate(['/calendario/cumpleanos']);
    } else if (item.link) {
      this.router.navigateByUrl(item.link);
    }
  }

  protected async onSave(input: CalendarEventInput) {
    const editing = this.editing();
    try {
      await this.store.saveEvent(editing?.id ?? null, input);
      this.editing.set(undefined);
      this.selected.set(input.date);
      await this.reload();
    } catch (err) {
      this.dialog()?.showError(errorMessage(err, 'No se pudo guardar.'));
    }
  }

  protected async onDelete() {
    const editing = this.editing();
    if (!editing) return;
    try {
      await this.store.removeEvent(editing.id);
      this.editing.set(undefined);
      await this.reload();
    } catch (err) {
      this.dialog()?.showError(errorMessage(err, 'No se pudo borrar.'));
    }
  }

  private reload() {
    const days = this.days();
    return this.load(days[0], days[days.length - 1]);
  }

  private async load(from: IsoDate, to: IsoDate) {
    this.loading.set(true);
    try {
      const items = await this.store.items(from, to);
      const days = this.days();
      if (days[0] !== from || days[days.length - 1] !== to) return;
      this.items.set(items);
      this.error.set('');
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo cargar el calendario.'));
    } finally {
      this.loading.set(false);
    }
  }
}

function readFilter(): string | null {
  try {
    return localStorage.getItem(FILTER_KEY);
  } catch {
    return null;
  }
}
