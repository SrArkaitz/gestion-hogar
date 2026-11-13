/** Comentario en una tarea o en una idea. */
export interface Comment {
  id: string;
  authorId: string;
  /** Nombre de quien lo escribió (aunque ya no esté en la casa). */
  authorName: string;
  text: string;
  createdAt: string;
}

export interface CommentInput {
  text: string;
}

/** Largo máximo de un comentario. */
export const COMMENT_MAX = 1000;
