import { IsoDate, Priority } from './common';

/**
 * Cada cuánto se repite una tarea: cada N días, semanas o meses, o ciertos días de la semana.
 * En "meses" se repite el mismo día del mes que la fecha de inicio (el 31 cae el último día
 * de los meses más cortos).
 */
export const RECURRENCE_FREQUENCIES = ['dias', 'semanas', 'meses', 'dias_semana'] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  dias: 'Cada N días',
  semanas: 'Cada N semanas',
  meses: 'Cada N meses',
  dias_semana: 'Días de la semana',
};

export const RECURRENCE_INTERVAL_MAX = 365;

/** Días de la semana de lunes (1) a domingo (7), como en ISO 8601. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const WEEKDAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
export const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;

export interface Recurrence {
  frequency: RecurrenceFrequency;
  /** Cada cuántos días, semanas o meses. En "dias_semana" es siempre 1. */
  interval: number;
  /** Solo en "dias_semana": días de 1 (lunes) a 7 (domingo), ordenados. */
  weekdays: number[];
  /** Primera fecha posible; en "semanas" y "meses" marca el ritmo. */
  startDate: IsoDate;
}

/** Plantilla de una tarea que se crea sola cada cierto tiempo. */
export interface RecurringTask extends Recurrence {
  id: string;
  title: string;
  notes: string;
  priority: Priority;
  category: string | null;
  assigneeIds: string[];
  /** Fecha en la que se creará la próxima tarea. */
  nextDate: IsoDate;
  /** Pausada: no crea tareas hasta que se reactive. */
  active: boolean;
  createdById: string;
  createdAt: string;
}

export interface RecurringTaskInput {
  title: string;
  notes?: string;
  priority: Priority;
  category?: string | null;
  assigneeIds?: string[];
  frequency: RecurrenceFrequency;
  interval?: number;
  weekdays?: number[];
  startDate: IsoDate;
  active?: boolean;
}

/** Primera fecha en la que toca la tarea que sea igual o posterior a `from`. */
export function occurrenceOnOrAfter(r: Recurrence, from: IsoDate): IsoDate {
  if (from < r.startDate) from = r.startDate;
  switch (r.frequency) {
    case 'dias':
    case 'semanas': {
      const step = r.interval * (r.frequency === 'semanas' ? 7 : 1);
      const elapsed = daysBetween(r.startDate, from);
      return addDays(r.startDate, Math.ceil(elapsed / step) * step);
    }
    case 'meses': {
      const [y, m] = r.startDate.split('-').map(Number);
      const [fy, fm] = from.split('-').map(Number);
      // Desde el ciclo del mes de `from` (o el anterior) hacia delante.
      let k = Math.max(0, Math.floor(((fy - y) * 12 + (fm - m)) / r.interval) - 1);
      for (;;) {
        const date = addMonthsClamped(r.startDate, k * r.interval);
        if (date >= from) return date;
        k++;
      }
    }
    case 'dias_semana': {
      if (!r.weekdays.length) throw new Error('Sin días de la semana');
      let date = from;
      while (!r.weekdays.includes(isoWeekday(date))) date = addDays(date, 1);
      return date;
    }
  }
}

/** "Cada día", "Cada 2 semanas", "Los lunes y jueves", "Cada mes, el día 15"… */
export function describeRecurrence(r: Recurrence): string {
  const n = r.interval;
  switch (r.frequency) {
    case 'dias':
      return n === 1 ? 'Cada día' : `Cada ${n} días`;
    case 'semanas': {
      const day = WEEKDAY_NAMES[isoWeekday(r.startDate) - 1];
      return `${n === 1 ? 'Cada semana' : `Cada ${n} semanas`}, el ${day}`;
    }
    case 'meses': {
      const day = Number(r.startDate.slice(8));
      return `${n === 1 ? 'Cada mes' : `Cada ${n} meses`}, el día ${day}`;
    }
    case 'dias_semana': {
      if (r.weekdays.length === 7) return 'Cada día';
      if (r.weekdays.join() === '1,2,3,4,5') return 'De lunes a viernes';
      // sábado → sábados; los demás ya acaban en s
      const names = r.weekdays.map((d) => WEEKDAY_NAMES[d - 1].replace(/o$/, 'os'));
      return 'Los ' + (names.length > 1 ? names.slice(0, -1).join(', ') + ' y ' + names.at(-1) : names[0]);
    }
  }
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 1 = lunes … 7 = domingo. */
export function isoWeekday(date: IsoDate): number {
  return toUtc(date).getUTCDay() || 7;
}

function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** Suma meses conservando el día; si el mes no lo tiene, usa su último día. */
function addMonthsClamped(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, lastDay));
  return first.toISOString().slice(0, 10);
}

function toUtc(date: IsoDate): Date {
  return new Date(date + 'T00:00:00Z');
}
