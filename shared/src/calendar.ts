import { IsoDate } from './common';

/** De dónde sale cada cosa del calendario. Los dos primeros son del propio calendario. */
export const CALENDAR_KINDS = ['evento', 'cumple', 'tarea', 'recurrente', 'menu', 'factura'] as const;
export type CalendarKind = (typeof CALENDAR_KINDS)[number];

export const CALENDAR_KIND_LABELS: Record<CalendarKind, string> = {
  evento: 'Evento',
  cumple: 'Cumpleaños',
  tarea: 'Tarea',
  recurrente: 'Tarea recurrente',
  menu: 'Menú',
  factura: 'Factura',
};

export const EVENT_TITLE_MAX = 120;
export const EVENT_NOTES_MAX = 1000;
/** Un evento puede durar como mucho un año. */
export const EVENT_DAYS_MAX = 366;
export const BIRTHDAY_NAME_MAX = 80;
export const BIRTHDAY_NOTICE_MAX = 30;
/** Días como mucho que se piden de una vez (la vista de mes enseña 6 semanas). */
export const CALENDAR_RANGE_MAX = 62;

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Lo que se pinta en el calendario, venga de donde venga. */
export interface CalendarItem {
  kind: CalendarKind;
  date: IsoDate;
  title: string;
  /** "21:00", "Comida · 4 raciones", "Unos 45,00 €"… */
  detail: string | null;
  /** Hora (HH:MM) para ordenar dentro del día, si la tiene. */
  time: string | null;
  /** Id del evento, cumpleaños, tarea, receta o factura. */
  refId: string;
  /** Página de la app donde se ve (los eventos y cumpleaños se editan en el calendario). */
  link: string | null;
  /** Tarea ya hecha (se pinta tachada). */
  done: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: IsoDate;
  /** Último día si dura varios, o null. */
  endDate: IsoDate | null;
  /** HH:MM, o null si es de todo el día. */
  time: string | null;
  notes: string;
}

export interface CalendarEventInput {
  title: string;
  date: IsoDate;
  endDate?: IsoDate | null;
  time?: string | null;
  notes?: string;
}

export interface Birthday {
  id: string;
  name: string;
  month: number;
  day: number;
  /** Año de nacimiento, si se sabe (para decir cuántos cumple). */
  year: number | null;
  /** Con cuántos días de antelación avisar (además del mismo día). 0: solo ese día. */
  notifyDays: number;
}

export interface BirthdayInput {
  name: string;
  month: number;
  day: number;
  year?: number | null;
  notifyDays?: number;
}

/** Días de un mes (en un año bisiesto si no se dice, para admitir el 29 de febrero). */
export function daysInMonth(month: number, year = 2024): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Fecha del cumpleaños en un año. El 29 de febrero, los años no bisiestos, se celebra el 28. */
export function birthdayIn(b: { month: number; day: number }, year: number): IsoDate {
  const day = Math.min(b.day, daysInMonth(b.month, year));
  return `${year}-${String(b.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Próximo cumpleaños a partir de una fecha (incluida). */
export function nextBirthday(b: { month: number; day: number }, from: IsoDate): IsoDate {
  const year = Number(from.slice(0, 4));
  const thisYear = birthdayIn(b, year);
  return thisYear >= from ? thisYear : birthdayIn(b, year + 1);
}

/** Años que cumple en esa fecha de cumpleaños, o null si no se sabe el año. */
export function ageOn(b: { year: number | null }, date: IsoDate): number | null {
  return b.year ? Number(date.slice(0, 4)) - b.year : null;
}
