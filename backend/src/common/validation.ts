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

/** Ruta interna a la que volver tras entrar. Cualquier cosa que no empiece por "/" (u otra web) se cambia por "/". */
export function safeReturnUrl(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : '/';
}

/** Valor que tiene que estar en una lista de constantes de @hogar/shared. */
export function oneOf<T extends string>(value: unknown, options: readonly T[], label: string): T {
  if (!options.includes(value as T)) throw new BadRequestException(`${label} no válido`);
  return value as T;
}

/** Texto opcional: recortado, null si viene vacío y con longitud máxima. */
export function optionalText(value: unknown, label: string, max: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new BadRequestException(`${label} no válido`);
  const text = value.trim();
  if (text.length > max) throw new BadRequestException(`${label} no puede pasar de ${max} caracteres`);
  return text || null;
}
