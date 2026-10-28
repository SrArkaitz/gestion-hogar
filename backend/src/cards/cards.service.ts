import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Card, CardInput, COLUMNS, PRIORITIES } from './card.model';
import { DatabaseService } from './database.service';

interface Row {
  id: string;
  title: string;
  note: string;
  column_id: string;
  priority: string;
  due: string;
  created_at: number;
  updated_at: number;
}

const toCard = (r: Row): Card => ({
  id: r.id,
  title: r.title,
  note: r.note,
  column: r.column_id as Card['column'],
  priority: r.priority as Card['priority'],
  due: r.due,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

@Injectable()
export class CardsService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  findAll(): Card[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM cards
         ORDER BY CASE priority WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, created_at`,
      )
      .all() as Row[];
    return rows.map(toCard);
  }

  findOne(id: string): Card {
    const row = this.db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as Row | undefined;
    if (!row) throw new NotFoundException('La tarjeta no existe');
    return toCard(row);
  }

  create(body: unknown): Card {
    const input = this.validate(body, false) as CardInput;
    const now = Date.now();
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO cards (id, title, note, column_id, priority, due, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.title, input.note, input.column, input.priority, input.due, now, now);
    return this.findOne(id);
  }

  /** Actualiza solo los campos enviados (sirve también para mover de columna). */
  update(id: string, body: unknown): Card {
    const current = this.findOne(id);
    const patch = this.validate(body, true);
    const next = { ...current, ...patch, updatedAt: Date.now() };
    this.db
      .prepare(
        `UPDATE cards SET title = ?, note = ?, column_id = ?, priority = ?, due = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(next.title, next.note, next.column, next.priority, next.due, next.updatedAt, id);
    return this.findOne(id);
  }

  remove(id: string): void {
    const res = this.db.prepare('DELETE FROM cards WHERE id = ?').run(id);
    if (res.changes === 0) throw new NotFoundException('La tarjeta no existe');
  }

  private validate(body: unknown, partial: boolean): Partial<CardInput> {
    if (!body || typeof body !== 'object') throw new BadRequestException('Cuerpo vacío');
    const b = body as Record<string, unknown>;
    const out: Partial<CardInput> = {};

    if (b.title !== undefined || !partial) {
      const title = typeof b.title === 'string' ? b.title.trim() : '';
      if (!title) throw new BadRequestException('El título es obligatorio');
      if (title.length > 120) throw new BadRequestException('El título no puede pasar de 120 caracteres');
      out.title = title;
    }
    if (b.note !== undefined || !partial) {
      const note = typeof b.note === 'string' ? b.note.trim() : '';
      if (note.length > 1000) throw new BadRequestException('Las notas no pueden pasar de 1000 caracteres');
      out.note = note;
    }
    if (b.column !== undefined || !partial) {
      if (!COLUMNS.includes(b.column as never)) throw new BadRequestException('Columna no válida');
      out.column = b.column as CardInput['column'];
    }
    if (b.priority !== undefined || !partial) {
      if (!PRIORITIES.includes(b.priority as never)) throw new BadRequestException('Prioridad no válida');
      out.priority = b.priority as CardInput['priority'];
    }
    if (b.due !== undefined || !partial) {
      const due = typeof b.due === 'string' ? b.due : '';
      if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new BadRequestException('Fecha no válida (AAAA-MM-DD)');
      out.due = due;
    }
    return out;
  }
}
