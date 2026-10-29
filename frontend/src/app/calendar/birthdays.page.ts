import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ageOn, Birthday, BIRTHDAY_NAME_MAX, daysInMonth, nextBirthday } from '@hogar/shared';
import { todayIso } from '../core/dates';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';
import { CalendarTabs } from './calendar-tabs';
import { CalendarStore } from './calendar.store';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** Opciones de aviso: el mismo día o con estos días de antelación. */
const NOTICE_OPTIONS = [0, 1, 2, 3, 7, 14];

interface Row {
  b: Birthday;
  next: string;
  daysLeft: number;
  age: number | null;
}

/** Cumpleaños de la casa, del más cercano al más lejano. */
@Component({
  selector: 'app-birthdays-page',
  imports: [FormsModule, CalendarTabs],
  host: { class: 'view' },
  templateUrl: './birthdays.page.html',
})
export class BirthdaysPage {
  private readonly store = inject(CalendarStore);
  private readonly session = inject(SessionService);

  protected readonly months = MONTHS;
  protected readonly noticeOptions = NOTICE_OPTIONS;
  protected readonly nameMax = BIRTHDAY_NAME_MAX;
  protected readonly thisYear = new Date().getFullYear();

  protected readonly birthdays = signal<Birthday[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected readonly rows = computed<Row[]>(() => {
    const today = todayIso();
    return this.birthdays()
      .map((b) => {
        const next = nextBirthday(b, today);
        return { b, next, daysLeft: Math.round((Date.parse(next) - Date.parse(today)) / 86_400_000), age: ageOn(b, next) };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft || a.b.name.localeCompare(b.b.name, 'es'));
  });

  // Diálogo: undefined = cerrado, null = nuevo.
  protected readonly editing = signal<Birthday | null | undefined>(undefined);
  protected readonly name = signal('');
  protected readonly month = signal(1);
  protected readonly day = signal(1);
  protected readonly year = signal<number | null>(null);
  protected readonly notifyDays = signal(3);
  protected readonly formError = signal('');
  protected readonly dayOptions = computed(() => Array.from({ length: daysInMonth(this.month()) }, (_, i) => i + 1));

  constructor() {
    effect(() => {
      if (this.session.household()?.id) void this.load();
    });
  }

  protected dateText(b: Birthday): string {
    return `${b.day} de ${MONTHS[b.month - 1]}`;
  }

  protected leftText(daysLeft: number): string {
    if (daysLeft === 0) return '¡Hoy!';
    if (daysLeft === 1) return 'Mañana';
    return `Faltan ${daysLeft} días`;
  }

  protected noticeText(days: number): string {
    return days === 0 ? 'el mismo día' : days === 1 ? '1 día antes' : `${days} días antes`;
  }

  protected open(b: Birthday | null) {
    this.name.set(b?.name ?? '');
    this.month.set(b?.month ?? new Date().getMonth() + 1);
    this.day.set(b?.day ?? 1);
    this.year.set(b?.year ?? null);
    this.notifyDays.set(b?.notifyDays ?? 3);
    this.formError.set('');
    this.editing.set(b);
  }

  protected setMonth(month: number) {
    this.month.set(month);
    // Si el día no existe en el mes nuevo (31 de abril), se queda en el último.
    this.day.update((d) => Math.min(d, daysInMonth(month)));
  }

  protected async save() {
    if (!this.name().trim()) return this.formError.set('Escribe el nombre.');
    const year = this.year() || null;
    if (year !== null && (year < 1900 || year > this.thisYear)) return this.formError.set(`El año tiene que estar entre 1900 y ${this.thisYear}.`);
    try {
      await this.store.saveBirthday(this.editing()?.id ?? null, {
        name: this.name(),
        month: +this.month(),
        day: +this.day(),
        year,
        notifyDays: +this.notifyDays(),
      });
      this.editing.set(undefined);
      await this.load();
    } catch (err) {
      this.formError.set(errorMessage(err, 'No se pudo guardar.'));
    }
  }

  protected async remove() {
    const b = this.editing();
    if (!b || !confirm(`¿Borrar el cumpleaños de ${b.name}?`)) return;
    try {
      await this.store.removeBirthday(b.id);
      this.editing.set(undefined);
      await this.load();
    } catch (err) {
      this.formError.set(errorMessage(err, 'No se pudo borrar.'));
    }
  }

  private async load() {
    try {
      this.birthdays.set(await this.store.birthdays());
      this.error.set('');
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudieron cargar los cumpleaños.'));
    } finally {
      this.loading.set(false);
    }
  }
}
