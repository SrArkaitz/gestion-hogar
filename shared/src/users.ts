export const ROLES = ['admin', 'miembro'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = { admin: 'Administrador', miembro: 'Miembro' };

export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MAX_LENGTH = 60;

/** Días que dura un enlace de invitación. */
export const INVITATION_DAYS = 7;

export interface User {
  id: string;
  name: string;
  email: string;
}

/** Casa tal como aparece en el selector: sin miembros. */
export interface HouseholdSummary {
  id: string;
  name: string;
  role: Role;
}

/** Respuesta de /api/auth/me: quién soy y en qué casas estoy. */
export interface Me {
  user: User;
  households: HouseholdSummary[];
}

/** Miembro de una casa tal como lo ve el resto de la app (sin datos de acceso). */
export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
}

export interface Household {
  id: string;
  name: string;
  members: Member[];
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Invitación pendiente, vista por un administrador de la casa. */
export interface Invitation {
  id: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
}

/** Invitación recién creada: el enlace solo se puede ver en este momento. */
export interface CreatedInvitation extends Invitation {
  token: string;
}

/** Lo que ve quien abre un enlace de invitación. */
export interface InvitationPreview {
  householdName: string;
  invitedBy: string;
  /** Si quien la abre ya es miembro de esa casa. */
  alreadyMember: boolean;
}
