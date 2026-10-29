import { BadRequestException } from '@nestjs/common';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Comprueba que el cuerpo de la petición es un objeto. */
export function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Cuerpo vacío');
  return body as Record<string, unknown>;
}

/** Texto obligatorio, recortado y con longitud máxima. */
export function requiredText(value: unknown, label: string, max: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new BadRequestException(`${label} es obligatorio`);
  if (text.length > max) throw new BadRequestException(`${label} no puede pasar de ${max} caracteres`);
  return text;
}

/** Correo en minúsculas. */
export function emailField(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 200) throw new BadRequestException('Correo no válido');
  return email;
}

/** Valor que tiene que estar en una lista de constantes de @hogar/shared. */
export function oneOf<T extends string>(value: unknown, options: readonly T[], label: string): T {
  if (!options.includes(value as T)) throw new BadRequestException(`${label} no válido`);
  return value as T;
}
