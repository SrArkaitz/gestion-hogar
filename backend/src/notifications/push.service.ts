import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PushConfig, PushPayload, PushSubscriptionInput } from '@hogar/shared';
import webpush, { WebPushError } from 'web-push';
import { asObject } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const PUBLIC_KEY = 'vapid_public';
const PRIVATE_KEY = 'vapid_private';

/**
 * Avisos push (Web Push con claves VAPID). Las claves se generan la primera vez y se guardan
 * en la base de datos, así que no hay que configurar nada y sobreviven a las actualizaciones.
 * Si cambiaran, los dispositivos tendrían que volver a activar los avisos.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private publicKey = '';

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    let keys = await this.loadKeys();
    if (!keys) {
      const generated = webpush.generateVAPIDKeys();
      await this.prisma.appSetting.createMany({
        data: [
          { key: PUBLIC_KEY, value: generated.publicKey },
          { key: PRIVATE_KEY, value: generated.privateKey },
        ],
      });
      keys = generated;
      this.logger.log('Claves para los avisos push generadas');
    }
    this.publicKey = keys.publicKey;
    webpush.setVapidDetails(subject(), keys.publicKey, keys.privateKey);
  }

  config(): PushConfig {
    return { publicKey: this.publicKey };
  }

  /** Guarda el dispositivo. Si ya estaba con otra cuenta (otra persona en el mismo navegador), pasa a esta. */
  async subscribe(userId: string, body: unknown): Promise<void> {
    const { endpoint, keys } = parseSubscription(body);
    await this.prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth },
    });
  }

  async unsubscribe(userId: string, body: unknown): Promise<void> {
    const endpoint = asObject(body)['endpoint'];
    if (typeof endpoint !== 'string') throw new BadRequestException('Falta endpoint');
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  /**
   * Manda un aviso a todos los dispositivos de esas personas. No lanza errores: un aviso que no
   * llega no debe romper lo que lo provocó. Los dispositivos que ya no existen se borran.
   * @returns cuántos dispositivos lo han recibido.
   */
  async send(userIds: string[], payload: PushPayload): Promise<number> {
    if (!userIds.length) return 0;
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
    const body = JSON.stringify(payload);
    const results = await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, {
            TTL: 60 * 60 * 24,
          });
          return true;
        } catch (err) {
          // 404 y 410: el navegador ha anulado la suscripción (avisos desactivados, app desinstalada…).
          if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          } else {
            this.logger.warn(`No se pudo mandar un aviso: ${(err as Error).message}`);
          }
          return false;
        }
      }),
    );
    return results.filter(Boolean).length;
  }

  private async loadKeys() {
    const rows = await this.prisma.appSetting.findMany({ where: { key: { in: [PUBLIC_KEY, PRIVATE_KEY] } } });
    const get = (key: string) => rows.find((r) => r.key === key)?.value;
    const publicKey = get(PUBLIC_KEY), privateKey = get(PRIVATE_KEY);
    return publicKey && privateKey ? { publicKey, privateKey } : null;
  }
}

/** Contacto que exige VAPID: la dirección pública de la app o, si no hay, un correo genérico. */
function subject(): string {
  const url = process.env.PUBLIC_URL;
  return url?.startsWith('https://') ? url : 'mailto:avisos@hogar.invalid';
}

function parseSubscription(body: unknown): PushSubscriptionInput {
  const b = asObject(body);
  const keys = b['keys'] as Record<string, unknown> | undefined;
  const ok =
    typeof b['endpoint'] === 'string' &&
    /^https:\/\//.test(b['endpoint']) &&
    b['endpoint'].length <= 1000 &&
    typeof keys?.['p256dh'] === 'string' &&
    typeof keys?.['auth'] === 'string';
  if (!ok) throw new BadRequestException('Suscripción no válida');
  return { endpoint: b['endpoint'] as string, keys: { p256dh: keys!['p256dh'] as string, auth: keys!['auth'] as string } };
}
