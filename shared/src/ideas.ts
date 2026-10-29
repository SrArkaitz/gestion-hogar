import { Priority } from './common';
import { Task } from './tasks';

export const IDEA_STATUSES = ['nueva', 'en_valoracion', 'aceptada', 'descartada'] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  nueva: 'Nueva',
  en_valoracion: 'En valoración',
  aceptada: 'Aceptada',
  descartada: 'Descartada',
};

/** Categorías que se ofrecen al crear una idea. Se puede escribir otra. */
export const IDEA_CATEGORIES = ['Casa', 'Viaje', 'Compra grande', 'Proyecto'] as const;

export interface Idea {
  id: string;
  title: string;
  description: string;
  status: IdeaStatus;
  category: string | null;
  proposedById: string;
  /** Tarea creada al aceptarla. */
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaInput {
  title: string;
  description?: string;
  category?: string | null;
  /** Para pasar a valoración, descartar o recuperar. "aceptada" solo se pone al aceptarla. */
  status?: Exclude<IdeaStatus, 'aceptada'>;
}

/** Datos para convertir una idea aceptada en tarea. */
export interface AcceptIdeaInput {
  priority: Priority;
}

export interface AcceptIdeaResult {
  idea: Idea;
  task: Task;
}
