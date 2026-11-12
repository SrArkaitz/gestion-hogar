/** Respuesta de /api/push/config: si el servidor manda avisos push y con qué clave pública (VAPID). */
export interface PushConfig {
  publicKey: string;
}

/** Suscripción del navegador tal como la da PushSubscription.toJSON(). */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

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
