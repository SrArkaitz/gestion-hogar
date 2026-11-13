/** Respuesta de /api/push/config: si el servidor manda avisos push y con qué clave pública (VAPID). */
export interface PushConfig {
  publicKey: string;
}

/** Suscripción del navegador tal como la da PushSubscription.toJSON(). */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Tipos de aviso: cada persona elige cuáles quiere (los de prueba llegan siempre). */
export const NOTIFICATION_KINDS = ['asignadas', 'comentarios', 'tareas', 'calendario', 'facturas', 'mantenimiento'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  asignadas: 'Tareas que te asignan',
  comentarios: 'Comentarios',
  tareas: 'Tareas pendientes',
  calendario: 'Calendario y cumpleaños',
  facturas: 'Facturas por pagar',
  mantenimiento: 'Revisiones de mantenimiento',
};

export const NOTIFICATION_KIND_DESCRIPTIONS: Record<NotificationKind, string> = {
  asignadas: 'Cuando alguien te pone en una tarea.',
  comentarios: 'Cuando comentan en una tarea o idea en la que estás.',
  tareas: 'A las 9:00, las tuyas que vencen hoy o ya vencieron.',
  calendario: 'A las 9:00, los eventos y cumpleaños del día.',
  facturas: 'A las 9:00, las que vencen en los próximos días.',
  mantenimiento: 'A las 9:00, las revisiones que tocan.',
};

/** Un aviso de la campanita. */
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  /** Ruta de la app que se abre al tocarlo. */
  url: string;
  read: boolean;
  createdAt: string;
}

/** Respuesta de /api/notifications: los últimos avisos y cuántos hay sin leer. */
export interface NotificationList {
  items: AppNotification[];
  unread: number;
}

/** Días que se guardan los avisos de la campanita. */
export const NOTIFICATION_KEEP_DAYS = 60;
/** Avisos que se devuelven como mucho (los más recientes). */
export const NOTIFICATION_LIST_MAX = 50;

/** Lo que llega al service worker en cada aviso. */
export interface PushPayload {
  title: string;
  body: string;
  /** Ruta de la app que se abre al tocar el aviso. */
  url: string;
  /** Avisos con la misma etiqueta se sustituyen en vez de acumularse. */
  tag?: string;
}
