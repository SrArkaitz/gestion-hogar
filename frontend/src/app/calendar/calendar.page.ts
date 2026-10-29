import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  addDays,
  CALENDAR_KIND_LABELS,
  CalendarEvent,
  CalendarEventInput,
  CalendarItem,
  IsoDate,
  startOfWeek,
  WEEKDAY_INITIALS,
} from '@hogar/shared';
import { monthLabel, monthOf, monthRange, shiftMonth, todayIso } from '../core/dates';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';
import { CalendarTabs } from './calendar-tabs';
import { CalendarStore } from './calendar.store';
import { EventDialog } from './event-dialog';

type View = 'mes' | 'semana';

/** Chips que caben en una casilla del mes (en el PC); el resto, "+N". */
const CHIPS_PER_DAY = 3;

/**
 * Calendario de la casa: vista de mes (con la lista del día elegido) y de semana. Junta los eventos
 * y cumpleaños con lo que tiene fecha en las demás secciones.
 */
@Component({
  selector: 'app-calendar-page',
  imports: [CalendarTabs, EventDialog],
  host: { class: 'view' },
  templateUrl: './calendar.page.html',
})
export class CalendarPage {
  private readonly store = inject(CalendarStore);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly kindLabels = CALENDAR_KIND_LABELS;
  protected readonly weekdayInitials = WEEKDAY_INITIALS;
  protected readonly chipsPerDay = CHIPS_PER_DAY;
  protected readonly today = todayIso();

  protected readonly view = signal<View>('mes');
  protected readonly month = signal(monthOf(this.today));
  protected readonly weekStart = signal(startOfWeek(this.today));
  protected readonly selected = signal<IsoDate>(this.today);

  protected readonly items = signal<CalendarItem[]>([]);
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

  protected readonly byDay = computed(() => {
    const map = new Map<IsoDate, CalendarItem[]>();
    for (const item of this.items()) map.set(item.date, [...(map.get(item.date) ?? []), item]);
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
  }

  protected itemsOn(day: IsoDate): CalendarItem[] {
    return this.byDay().get(day) ?? [];
  }

  /** Tipos distintos de un día, para los puntos del móvil. */
  protected kindsOn(day: IsoDate): string[] {
    return [...new Set(this.itemsOn(day).map((i) => i.kind))];
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
