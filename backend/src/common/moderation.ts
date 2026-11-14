/**
 * Moderadores de la app: los correos de MODERATOR_EMAILS (separados por comas). Pueden quitar de
 * las públicas, quitar la foto o borrar las recetas públicas de cualquier casa, e impedir que una
 * casa publique. No ven nada privado de las demás casas.
 */
export function isModerator(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env['MODERATOR_EMAILS'] ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
