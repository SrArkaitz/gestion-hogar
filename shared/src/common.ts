/** Fecha sin hora en formato AAAA-MM-DD. */
export type IsoDate = string;

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** AAAA-MM-DD y que el día exista (no vale el 30 de febrero, que Date.parse pasa a marzo). */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export const PRIORITIES = ['alta', 'media', 'baja'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Orden para listar: primero alta, luego media y luego baja. */
export const PRIORITY_ORDER: Record<Priority, number> = { alta: 0, media: 1, baja: 2 };

export const PRIORITY_LABELS: Record<Priority, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };
