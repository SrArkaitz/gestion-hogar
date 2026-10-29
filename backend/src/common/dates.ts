import { IsoDate } from '@hogar/shared';

/** Zona horaria de la casa: la de TZ, como la copia de seguridad. */
export const TIME_ZONE = process.env.TZ || 'Europe/Madrid';

/** Fecha de hoy (AAAA-MM-DD) en la zona horaria de la casa, no en UTC. */
export function todayIso(now = new Date()): IsoDate {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TIME_ZONE }).format(now);
}
