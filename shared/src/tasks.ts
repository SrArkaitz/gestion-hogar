import { IsoDate, Priority } from './common';

export const TASK_STATUSES = ['por_hacer', 'en_curso', 'hecho'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  por_hacer: 'Por hacer',
  en_curso: 'En curso',
  hecho: 'Hecho',
};

/** Días que una tarea se queda en Hecho antes de archivarse sola. */
export const TASK_ARCHIVE_DAYS = 7;

/** Una cosa de la lista de una tarea ("Limpiar la cocina": horno, nevera…). */
export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

/** Al guardar la lista: las que ya existían llevan su id; las nuevas, no. */
export interface ChecklistItemInput {
  id?: string;
  text: string;
  done?: boolean;
}

export const CHECKLIST_MAX_ITEMS = 30;
export const CHECKLIST_TEXT_MAX = 200;

/** Categorías que se ofrecen al crear una tarea. Se puede escribir otra. */
export const TASK_CATEGORIES = ['Casa', 'Recados', 'Papeleo'] as const;

export interface Task {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: Priority;
  due: IsoDate | null;
  category: string | null;
  /** Tarea personal: solo la ve quien la creó, y es suya. Las demás son del hogar. */
  personal: boolean;
  /** Personas asignadas (puede haber varias o ninguna). */
  assigneeIds: string[];
  createdById: string;
  /** Idea de la que salió, si la hay. */
  ideaId: string | null;
  /** Tarea recurrente que la creó, si la hay. */
  recurringId: string | null;
  /** Cuándo pasó a Hecho. */
  doneAt: string | null;
  /** Si está archivada (no sale en el tablero), cuándo se archivó. */
  archivedAt: string | null;
  /** Lista de cosas que hacer dentro de la tarea (puede estar vacía). */
  checklist: ChecklistItem[];
  /** Cuántos comentarios tiene. */
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  notes?: string;
  status?: TaskStatus;
  priority: Priority;
  due?: IsoDate | null;
  category?: string | null;
  assigneeIds?: string[];
  /** Solo al crearla: después no se cambia. */
  personal?: boolean;
  /** La lista entera (sustituye a la anterior). Para tachar una sola, mejor POST …/checklist/:itemId. */
  checklist?: ChecklistItemInput[];
}
