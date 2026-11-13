import { BadRequestException } from '@nestjs/common';
import { NOTIFICATION_KINDS, NotificationKind } from '@hogar/shared';

/** Tipos de aviso desactivados tal como se guardan (JSON); lo que no se reconozca se ignora. */
export function readKinds(stored: string): NotificationKind[] {
  try {
    const list = JSON.parse(stored);
    return Array.isArray(list) ? list.filter((k): k is NotificationKind => (NOTIFICATION_KINDS as readonly string[]).includes(k)) : [];
  } catch {
    return [];
  }
}

export function parseKinds(value: unknown): NotificationKind[] {
  if (!Array.isArray(value) || !value.every((k) => (NOTIFICATION_KINDS as readonly unknown[]).includes(k))) {
    throw new BadRequestException(`Tipos de aviso no válidos (${NOTIFICATION_KINDS.join(', ')})`);
  }
  return [...new Set(value as NotificationKind[])];
}
