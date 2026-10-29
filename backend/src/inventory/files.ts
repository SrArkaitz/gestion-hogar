import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { dirname, join, resolve } from 'path';
import { databaseFile } from '../prisma/prisma.service';

/** Carpeta de los archivos de los equipos: FILES_DIR o, por defecto, "files" junto a la base de datos. */
export function filesDir(): string {
  return resolve(process.env.FILES_DIR ?? join(dirname(databaseFile()), 'files'));
}

const TYPES: { mime: string; ext: string; test: (d: Buffer) => boolean }[] = [
  { mime: 'application/pdf', ext: 'pdf', test: (d) => d.toString('ascii', 0, 5) === '%PDF-' },
  { mime: 'image/jpeg', ext: 'jpg', test: (d) => d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff },
  { mime: 'image/png', ext: 'png', test: (d) => d.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', ext: 'webp', test: (d) => d.toString('ascii', 0, 4) === 'RIFF' && d.toString('ascii', 8, 12) === 'WEBP' },
];

/** Tipo del archivo según sus primeros bytes (no según lo que diga el navegador). */
export function fileType(data: Buffer): { mime: string; ext: string } {
  const type = data.length > 12 ? TYPES.find((t) => t.test(data)) : undefined;
  if (!type) throw new BadRequestException('El archivo tiene que ser un PDF o una imagen (JPG, PNG o WebP)');
  return type;
}

/** Nombre en disco: aleatorio, sin nada del nombre original. */
export function storedName(ext: string): string {
  return `${randomBytes(16).toString('hex')}.${ext}`;
}

export const STORED_RE = /^[0-9a-f]{32}\.(pdf|jpg|png|webp)$/;
