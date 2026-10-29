import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { dirname, join, resolve } from 'path';
import { databaseFile } from '../prisma/prisma.service';

/** Carpeta de las fotos: PHOTOS_DIR o, por defecto, "photos" junto a la base de datos (mismo volumen). */
export function photosDir(): string {
  return resolve(process.env.PHOTOS_DIR ?? join(dirname(databaseFile()), 'photos'));
}

export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/** Tipos de imagen admitidos, reconocidos por sus primeros bytes (no por lo que diga el navegador). */
export function photoExtension(data: Buffer): 'jpg' | 'png' | 'webp' {
  if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'jpg';
  if (data.length > 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (data.length > 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  throw new BadRequestException('La foto tiene que ser JPG, PNG o WebP');
}

/** Nombre nuevo en cada foto: así la dirección cambia y el navegador no enseña la anterior. */
export function photoFileName(recipeId: string, ext: string): string {
  return `${recipeId}-${randomBytes(4).toString('hex')}.${ext}`;
}

/** Nombre de archivo seguro (sin rutas) tal como lo genera photoFileName. */
export const PHOTO_FILE_RE = /^[0-9a-f-]{36}-[0-9a-f]{8}\.(jpg|png|webp)$/;
