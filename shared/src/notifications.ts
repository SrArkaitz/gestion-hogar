/** Respuesta de /api/push/config: si el servidor manda avisos push y con qué clave pública (VAPID). */
export interface PushConfig {
  publicKey: string;
}

/** Suscripción del navegador tal como la da PushSubscription.toJSON(). */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Lo que llega al service worker en cada aviso. */
export interface PushPayload {
  title: string;
  body: string;
  /** Ruta de la app que se abre al tocar el aviso. */
  url: string;
  /** Avisos con la misma etiqueta se sustituyen en vez de acumularse. */
  tag?: string;
}
