import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { databaseFile, PrismaService } from '../prisma/prisma.service';

const FILE_RE = /^hogar-\d{4}-\d{2}-\d{2}\.db$/;

/**
 * Copia diaria de la base de datos. Usa VACUUM INTO, que saca una copia coherente
 * aunque la app esté escribiendo (copiar el archivo a mano podría dar una copia rota).
 *
 * BACKUP_DIR: carpeta de las copias (por defecto, data/backups junto a la base de datos).
 * BACKUP_KEEP: cuántas copias diarias se guardan (por defecto 14).
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
      this.logger.log(`Copia de seguridad hecha: ${target}`);
    } catch (err) {
      this.logger.error(`No se pudo hacer la copia de seguridad: ${(err as Error).message}`);
    }
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
