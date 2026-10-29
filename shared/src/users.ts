import { ModuleKey } from './modules';

export const ROLES = ['admin', 'miembro'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = { admin: 'Administrador', miembro: 'Miembro' };

/** Colores que puede elegir cada persona en una casa (se ven en sus tarjetas y en su avatar). */
export const MEMBER_COLORS = [
  'azul',
  'verde',
  'naranja',
  'morado',
  'rojo',
  'celeste',
  'rosa',
  'lima',
  'amarillo',
  'gris',
] as const;
export type MemberColor = (typeof MEMBER_COLORS)[number];

export const MEMBER_COLOR_LABELS: Record<MemberColor, string> = {
  azul: 'Azul',
  verde: 'Verde',
  naranja: 'Naranja',
  morado: 'Morado',
  rojo: 'Rojo',
  celeste: 'Celeste',
  rosa: 'Rosa',
  lima: 'Lima',
  amarillo: 'Amarillo',
  gris: 'Gris',
};

/** Primer color que nadie usa en la casa; si están todos cogidos, se repiten en orden. */
export function nextMemberColor(used: readonly string[]): MemberColor {
  return MEMBER_COLORS.find((c) => !used.includes(c)) ?? MEMBER_COLORS[used.length % MEMBER_COLORS.length];
}

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
  /** Secciones que la casa no usa (las eligen los administradores). */
  hiddenModules: ModuleKey[];
}

/** Respuesta de /api/auth/me: quién soy y en qué casas estoy. */
export interface Me {
  user: User;
  households: HouseholdSummary[];
  /** Formas de entrar que tiene la cuenta. */
  account: { password: boolean; google: boolean };
}

/** Respuesta de /api/auth/providers: formas de entrar disponibles en el servidor. */
export interface AuthProviders {
  google: boolean;
}

/**
 * Errores al volver de Google. La API redirige a /entrar?error=… (o /casa?error=… al conectar)
 * y el frontend muestra el mensaje.
 */
export const GOOGLE_ERRORS = {
  cancelado: 'Has cancelado el acceso con Google.',
  'cuenta-existe':
    'Ya hay una cuenta con ese correo. Entra con tu contraseña y conecta Google desde Casa → Cuenta.',
  'google-en-uso': 'Esa cuenta de Google ya está conectada a otro usuario.',
  'correo-sin-verificar': 'Google no ha verificado el correo de esa cuenta.',
  fallo: 'No se pudo entrar con Google. Vuelve a intentarlo.',
} as const;
export type GoogleError = keyof typeof GOOGLE_ERRORS;

/** Miembro de una casa tal como lo ve el resto de la app (sin datos de acceso). */
export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  color: MemberColor;
  joinedAt: string;
}

export interface Household {
  id: string;
  name: string;
  hiddenModules: ModuleKey[];
  members: Member[];
}

/** Lo que puede cambiar un administrador de la casa. */
export interface HouseholdPatch {
  name?: string;
  /** Secciones ocultas (sustituye a la lista anterior). */
  hiddenModules?: ModuleKey[];
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
