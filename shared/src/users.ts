/** Miembro de un hogar tal como lo ve el resto de la app (sin datos de acceso). */
export interface Member {
  id: string;
  name: string;
  email: string;
}

export interface Household {
  id: string;
  name: string;
  members: Member[];
}
