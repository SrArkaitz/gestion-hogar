import { addDays, IsoDate } from '@hogar/shared';

/** Hoy en la hora del dispositivo (AAAA-MM-DD). */
export function todayIso(): IsoDate {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "hoy", "mañana" o "lun 3 nov" (con el año si no es este). */
export function whenText(date: IsoDate): string {
  const today = todayIso();
  if (date === today) return 'hoy';
  if (date === addDays(today, 1)) return 'mañana';
  const otherYear = date.slice(0, 4) !== today.slice(0, 4);
  return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(otherYear && { year: 'numeric' }),
  });
}

/** Mes de una fecha: "2026-10". */
export function monthOf(date: IsoDate): string {
  return date.slice(0, 7);
}

/** Primer y último día de un mes ("2026-10"). */
export function monthRange(month: string): { from: IsoDate; to: IsoDate } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** Mes anterior o siguiente: shiftMonth("2026-01", -1) = "2025-12". */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** "Octubre de 2026". */
export function monthLabel(month: string): string {
  const text = new Date(month + '-01T00:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}
