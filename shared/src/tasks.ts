import { IsoDate, Priority } from './common';

export const TASK_STATUSES = ['por_hacer', 'en_curso', 'hecho'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  por_hacer: 'Por hacer',
  en_curso: 'En curso',
  hecho: 'Hecho',
};

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
  /** Personas asignadas (puede haber varias o ninguna). */
  assigneeIds: string[];
  createdById: string;
  /** Idea de la que salió, si la hay. */
  ideaId: string | null;
  /** Tarea recurrente que la creó, si la hay. */
  recurringId: string | null;
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
}
