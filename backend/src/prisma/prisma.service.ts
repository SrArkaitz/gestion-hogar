import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { PrismaClient } from '../generated/prisma/client';

/** Cliente de Prisma compartido por todos los módulos. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL ?? 'file:./data/hogar.db';
    const file = resolve(url.replace(/^file:/, ''));
    mkdirSync(dirname(file), { recursive: true });
    super({ adapter: new PrismaBetterSqlite3({ url: file }) });
    new Logger(PrismaService.name).log(`Base de datos en ${file}`);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
