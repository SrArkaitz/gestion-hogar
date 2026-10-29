import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { PrismaClient } from '../generated/prisma/client';

/** Ruta absoluta del archivo SQLite, sacada de DATABASE_URL. */
export function databaseFile(): string {
  return resolve((process.env.DATABASE_URL ?? 'file:./data/hogar.db').replace(/^file:/, ''));
}

/** Cliente de Prisma compartido por todos los módulos. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const file = databaseFile();
    mkdirSync(dirname(file), { recursive: true });
    super({ adapter: new PrismaBetterSqlite3({ url: file }) });
    new Logger(PrismaService.name).log(`Base de datos en ${file}`);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
