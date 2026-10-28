export const COLUMNS = ['casa', 'hacer', 'ideas', 'hecho'] as const;
export const PRIORITIES = ['alta', 'media', 'baja'] as const;

export type ColumnId = (typeof COLUMNS)[number];
export type Priority = (typeof PRIORITIES)[number];

export interface Card {
  id: string;
  title: string;
  note: string;
  column: ColumnId;
  priority: Priority;
  /** Fecha límite en formato AAAA-MM-DD, o cadena vacía. */
  due: string;
  createdAt: number;
  updatedAt: number;
}

export type CardInput = Pick<Card, 'title' | 'note' | 'column' | 'priority' | 'due'>;
