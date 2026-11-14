import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ageOn, Birthday, BIRTHDAY_NAME_MAX, daysInMonth, Member, nextBirthday } from '@hogar/shared';
import { Avatar } from '../core/avatar';
import { HouseholdsService } from '../core/households.service';
import { initials } from '../tasks/people';
import { todayIso } from '../core/dates';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';
import { CalendarTabs } from './calendar-tabs';
import { CalendarStore } from './calendar.store';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** Se resaltan los que caen en estos días. */
const SOON_DAYS = 7;

interface Row {
  b: Birthday;
  /** Si es de alguien de la casa que lo puso en su cuenta (se cambia allí, no aquí). */
  member: Member | null;
  next: string;
  daysLeft: number;
  age: number | null;
}

/** Cumpleaños de la casa, del más cercano al más lejano. */
@Component({
  selector: 'app-birthdays-page',
  imports: [Avatar, FormsModule, CalendarTabs],
  host: { class: 'view' },
  templateUrl: './birthdays.page.html',
})
export class BirthdaysPage {
  private readonly store = inject(CalendarStore);
  private readonly session = inject(SessionService);
  private readonly households = inject(HouseholdsService);
  private readonly router = inject(Router);
  protected readonly initials = initials;

  protected readonly months = MONTHS;
  protected readonly soonDays = SOON_DAYS;
  protected readonly nameMax = BIRTHDAY_NAME_MAX;
  protected readonly thisYear = new Date().getFullYear();

  protected readonly birthdays = signal<Birthday[]>([]);
  /** Gente de la casa (sus cumpleaños, si los han puesto en su cuenta). */
  protected readonly members = signal<Member[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected readonly rows = computed<Row[]>(() => {
    const today = todayIso();
    const written = new Set(this.birthdays().map((b) => `${b.month}-${b.day}-${b.name.trim().toLowerCase()}`));
    const fromMembers = this.members()
      .filter((m) => m.birthday && !written.has(`${m.birthday.month}-${m.birthday.day}-${m.name.trim().toLowerCase()}`))
      .map((m) => ({ b: { id: 'cuenta-' + m.id, name: m.name, month: m.birthday!.month, day: m.birthday!.day, year: null }, member: m }));
    return [...this.birthdays().map((b) => ({ b, member: null })), ...fromMembers]
      .map(({ b, member }) => {
        const next = nextBirthday(b, today);
        return { b, member, next, daysLeft: Math.round((Date.parse(next) - Date.parse(today)) / 86_400_000), age: ageOn(b, next) };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft || a.b.name.localeCompare(b.b.name, 'es'));
  });

  // Diálogo: undefined = cerrado, null = nuevo.
  protected readonly editing = signal<Birthday | null | undefined>(undefined);
  protected readonly name = signal('');
  protected readonly month = signal(1);
  protected readonly day = signal(1);
  protected readonly year = signal<number | null>(null);
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

  /** Tocar uno: los apuntados aquí se editan; el tuyo de la cuenta, en Tu cuenta; el de otro, en Casa. */
  protected tap(r: Row) {
    if (!r.member) return this.open(r.b);
    void this.router.navigate([r.member.id === this.session.user()?.id ? '/cuenta' : '/casa']);
  }

  protected open(b: Birthday | null) {
    this.name.set(b?.name ?? '');
    this.month.set(b?.month ?? new Date().getMonth() + 1);
    this.day.set(b?.day ?? 1);
    this.year.set(b?.year ?? null);
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
      const id = this.session.household()!.id;
      const [birthdays, household] = await Promise.all([this.store.birthdays(), this.households.get(id)]);
      this.birthdays.set(birthdays);
      this.members.set(household.members);
      this.error.set('');
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudieron cargar los cumpleaños.'));
    } finally {
      this.loading.set(false);
    }
  }
}
