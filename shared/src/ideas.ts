import { Priority } from './common';

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
}

/** Datos para convertir una idea aceptada en tarea. */
export interface AcceptIdeaInput {
  priority: Priority;
}
