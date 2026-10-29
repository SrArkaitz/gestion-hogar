import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { databaseFile, PrismaService } from '../prisma/prisma.service';
import { filesDir } from '../inventory/files';
import { photosDir } from '../recipes/photos';

const FILE_RE = /^hogar-\d{4}-\d{2}-\d{2}\.db$/;

/**
 * Copia diaria de la base de datos. Usa VACUUM INTO, que saca una copia coherente
 * aunque la app esté escribiendo (copiar el archivo a mano podría dar una copia rota).
 *
 * BACKUP_DIR: carpeta de las copias (por defecto, data/backups junto a la base de datos).
 * BACKUP_KEEP: cuántas copias diarias se guardan (por defecto 14).
 *
 * Las fotos de las recetas se copian a BACKUP_DIR/fotos y los archivos de los equipos a
 * BACKUP_DIR/archivos. Cada uno tiene un nombre único y no cambia, así que basta con copiar los
 * nuevos; los viejos se dejan porque las copias anteriores de la base de datos pueden seguir
 * apuntando a ellos.
 */
@Injectable()
export class BackupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BackupService.name);
  private readonly dir = resolve(process.env.BACKUP_DIR ?? join(dirname(databaseFile()), 'backups'));
  private readonly keep = Math.max(1, Number(process.env.BACKUP_KEEP ?? 14) || 14);

  constructor(private readonly prisma: PrismaService) {}

  /** Si hoy aún no hay copia (por ejemplo, el servidor estaba apagado a la hora), la hace al arrancar. */
  async onApplicationBootstrap() {
    if (!existsSync(join(this.dir, fileName(new Date())))) await this.run();
  }

  @Cron('0 30 3 * * *', { timeZone: process.env.TZ || 'Europe/Madrid' })
  async run(): Promise<void> {
    try {
      mkdirSync(this.dir, { recursive: true });
      const target = join(this.dir, fileName(new Date()));
      // VACUUM INTO no sobrescribe: si ya existe la de hoy, se sustituye.
      if (existsSync(target)) unlinkSync(target);
      await this.prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
      this.prune();
      const copied = this.copyNew(photosDir(), 'fotos') + this.copyNew(filesDir(), 'archivos');
      this.logger.log(`Copia de seguridad hecha: ${target}${copied ? ` y ${copied} fotos o archivos nuevos` : ''}`);
    } catch (err) {
      this.logger.error(`No se pudo hacer la copia de seguridad: ${(err as Error).message}`);
    }
  }

  /** Copia los archivos de una carpeta que aún no estén en la copia. @returns cuántos ha copiado. */
  private copyNew(source: string, folder: string): number {
    if (!existsSync(source)) return 0;
    const target = join(this.dir, folder);
    mkdirSync(target, { recursive: true });
    const copied = new Set(readdirSync(target));
    let count = 0;
    for (const file of readdirSync(source)) {
      if (copied.has(file)) continue;
      copyFileSync(join(source, file), join(target, file));
      count++;
    }
    return count;
  }

  /** Borra las copias más antiguas y deja las BACKUP_KEEP más recientes. */
  private prune() {
    const files = readdirSync(this.dir).filter((f) => FILE_RE.test(f)).sort();
    for (const old of files.slice(0, Math.max(0, files.length - this.keep))) unlinkSync(join(this.dir, old));
  }
}

function fileName(date: Date): string {
  const d = new Intl.DateTimeFormat('sv-SE', { timeZone: process.env.TZ || 'Europe/Madrid' }).format(date);
  return `hogar-${d}.db`;
}
