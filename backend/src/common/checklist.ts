import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { CHECKLIST_MAX_ITEMS, CHECKLIST_TEXT_MAX, ChecklistItem } from '@hogar/shared';

const newId = () => randomBytes(4).toString('hex');

/** Lee la lista guardada (JSON); si estuviera mal, vacía. */
export function readChecklist(stored: string): ChecklistItem[] {
  try {
    const list = JSON.parse(stored);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Lee la plantilla de una recurrente (solo textos). */
export function readTemplate(stored: string): string[] {
  try {
    const list = JSON.parse(stored);
    return Array.isArray(list) ? list.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

function text(value: unknown): string {
  const t = typeof value === 'string' ? value.trim() : '';
  if (!t) throw new BadRequestException('Cada cosa de la lista necesita un texto');
  if (t.length > CHECKLIST_TEXT_MAX) throw new BadRequestException(`Cada cosa de la lista puede tener hasta ${CHECKLIST_TEXT_MAX} caracteres`);
  return t;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new BadRequestException('La lista tiene que ser una lista');
  if (value.length > CHECKLIST_MAX_ITEMS) throw new BadRequestException(`La lista puede tener hasta ${CHECKLIST_MAX_ITEMS} cosas`);
  return value;
}

/** Lista de una tarea: las que traen un id que ya existía lo conservan; las demás reciben uno nuevo. */
export function parseChecklist(value: unknown, current: ChecklistItem[] = []): ChecklistItem[] {
  const known = new Set(current.map((i) => i.id));
  const used = new Set<string>();
  return array(value).map((raw) => {
    const item = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : { text: raw };
    if (item['done'] !== undefined && typeof item['done'] !== 'boolean') throw new BadRequestException('«Hecho» tiene que ser sí o no');
    const keep = typeof item['id'] === 'string' && known.has(item['id']) && !used.has(item['id']);
    const id = keep ? (item['id'] as string) : newId();
    used.add(id);
    return { id, text: text(item['text']), done: item['done'] === true };
  });
}

/** Plantilla de una recurrente: solo los textos. */
export function parseTemplate(value: unknown): string[] {
  return array(value).map(text);
}

/** La lista de una tarea nueva creada desde una plantilla: todo sin tachar. */
export function fromTemplate(template: string[]): ChecklistItem[] {
  return template.map((t) => ({ id: newId(), text: t, done: false }));
}
