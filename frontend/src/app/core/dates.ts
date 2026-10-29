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
