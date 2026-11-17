/** Motivo que se manda a la casa al moderar una de sus recetas. */
export const MODERATION_REASON_MAX = 200;

/** Motivos rápidos (también se puede escribir otro). */
export const MODERATION_REASONS = ['Contenido inapropiado', 'Foto inapropiada', 'Spam o publicidad', 'No es una receta'] as const;

/** Motivos rápidos al cambiar el nombre de una receta. */
export const RENAME_REASONS = ['El nombre no describe el plato', 'Nombre inapropiado', 'Nombre demasiado genérico'] as const;

/** Lo que ve un moderador de una receta pública de otra casa. */
export interface ModerationRecipeInfo {
  householdId: string;
  householdName: string;
  /** La casa no puede hacer públicas sus recetas. */
  publishBlocked: boolean;
}

/** Casa que no puede publicar recetas. */
export interface BlockedHousehold {
  id: string;
  name: string;
  blockedAt: string;
}

/** Cuerpo de las acciones de moderación. */
export interface ModerationInput {
  reason: string;
}

/** Cambiar el nombre de una receta pública. */
export interface ModerationRenameInput extends ModerationInput {
  name: string;
}
