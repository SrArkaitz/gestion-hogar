import { Member } from '@hogar/shared';

/** Funciones para mostrar a las personas asignadas (tareas y tareas recurrentes). */

/** Miembros asignados, en el orden de la casa. */
export function assigneesOf(members: Member[], ids: string[]): Member[] {
  return members.filter((m) => ids.includes(m.id));
}

/** Lateral de una tarjeta: el color de cada persona, a partes iguales. null si no hay nadie. */
export function stripeFor(people: Member[]): string | null {
  const colors = people.map((m) => `var(--c-${m.color})`);
  if (colors.length <= 1) return colors[0] ?? null;
  const step = 100 / colors.length;
  const stops = colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`);
  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}

/** "Asignada a Ana, Luis y Pepe". */
export function assigneesLabel(people: Member[]): string {
  const names = people.map((m) => m.name);
  return 'Asignada a ' + (names.length > 1 ? names.slice(0, -1).join(', ') + ' y ' + names.at(-1) : names[0]);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
