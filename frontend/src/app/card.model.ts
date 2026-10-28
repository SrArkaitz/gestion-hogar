export type ColumnId = 'casa' | 'hacer' | 'ideas' | 'hecho';
export type Priority = 'alta' | 'media' | 'baja';

export interface Card {
  id: string;
  title: string;
  note: string;
  column: ColumnId;
  priority: Priority;
  /** AAAA-MM-DD o cadena vacía */
  due: string;
  createdAt: number;
  updatedAt: number;
}

export type CardInput = Pick<Card, 'title' | 'note' | 'column' | 'priority' | 'due'>;

export interface Column {
  id: ColumnId;
  name: string;
  desc: string;
}

export const COLUMNS: Column[] = [
  { id: 'casa', name: 'Tareas de casa', desc: 'Limpieza, compras, arreglos' },
  { id: 'hacer', name: 'Por hacer', desc: 'Pendientes con fecha o sin ella' },
  { id: 'ideas', name: 'Ideas', desc: 'Cosas que algún día' },
  { id: 'hecho', name: 'Hecho', desc: 'Terminadas' },
];

export const PRIORITIES: Priority[] = ['alta', 'media', 'baja'];
export const PRIORITY_ORDER: Record<Priority, number> = { alta: 0, media: 1, baja: 2 };
