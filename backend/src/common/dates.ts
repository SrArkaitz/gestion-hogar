import { IsoDate } from '@hogar/shared';

/** Zona horaria de la casa: la de TZ, como la copia de seguridad. */
export const TIME_ZONE = process.env.TZ || 'Europe/Madrid';

/** Minutos desde las 00:00 de ahora en la zona horaria de la casa. */
export function minutesNow(now = new Date()): number {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now).split(':');
  return Number(h) * 60 + Number(m);
}

/** Fecha de hoy (AAAA-MM-DD) en la zona horaria de la casa, no en UTC. */
export function todayIso(now = new Date()): IsoDate {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TIME_ZONE }).format(now);
}
