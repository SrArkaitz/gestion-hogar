/** Fecha sin hora en formato AAAA-MM-DD. */
export type IsoDate = string;

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const PRIORITIES = ['alta', 'media', 'baja'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Orden para listar: primero alta, luego media y luego baja. */
export const PRIORITY_ORDER: Record<Priority, number> = { alta: 0, media: 1, baja: 2 };

export const PRIORITY_LABELS: Record<Priority, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };
