import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  db!: Database.Database;

  onModuleInit() {
    const file = process.env.DB_PATH ?? join(process.cwd(), 'data', 'hogar.db');
    mkdirSync(dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cards (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        note        TEXT NOT NULL DEFAULT '',
        column_id   TEXT NOT NULL,
        priority    TEXT NOT NULL,
        due         TEXT NOT NULL DEFAULT '',
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );
    `);
    this.logger.log(`Base de datos en ${file}`);
    this.seedIfEmpty();
  }

  onModuleDestroy() {
    this.db?.close();
  }

  /** La primera vez que arranca mete unas tarjetas de ejemplo. */
  private seedIfEmpty() {
    const { n } = this.db.prepare('SELECT COUNT(*) AS n FROM cards').get() as { n: number };
    if (n > 0) return;
    const now = Date.now();
    const insert = this.db.prepare(
      `INSERT INTO cards (id, title, note, column_id, priority, due, created_at, updated_at)
       VALUES (@id, @title, @note, @column, @priority, @due, @createdAt, @createdAt)`,
    );
    const examples = [
      { title: 'Purgar los radiadores', note: 'Antes de que apriete el frío.', column: 'casa', priority: 'alta' },
      { title: 'Bajar el reciclaje', note: '', column: 'casa', priority: 'media' },
      { title: 'Pedir cita ITV del coche', note: '', column: 'hacer', priority: 'alta' },
      { title: 'Cambiar bombilla del baño', note: 'E27, luz cálida', column: 'hacer', priority: 'baja' },
      { title: 'Estantería en el pasillo', note: 'Medir el hueco primero', column: 'ideas', priority: 'baja' },
      { title: 'Comprar detergente', note: '', column: 'hecho', priority: 'media' },
    ];
    const tx = this.db.transaction(() => {
      examples.forEach((e, i) =>
        insert.run({ ...e, id: `ejemplo-${i + 1}`, due: '', createdAt: now + i }),
      );
    });
    tx();
    this.logger.log('Tablero vacío: añadidas tarjetas de ejemplo');
  }
}
