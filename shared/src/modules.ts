/** Secciones de la app que cada casa puede ocultar. "Casa" (ajustes) no está: siempre se ve. */
export const MODULES = ['tareas', 'calendario', 'ideas', 'compra', 'recetas', 'gastos'] as const;
export type ModuleKey = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  tareas: 'Tareas',
  calendario: 'Calendario',
  ideas: 'Ideas',
  compra: 'Compra',
  recetas: 'Recetas',
  gastos: 'Gastos y facturas',
};

export const MODULE_DESCRIPTIONS: Record<ModuleKey, string> = {
  tareas: 'Tablero de tareas y tareas recurrentes.',
  calendario: 'Lo que tiene fecha, cumpleaños y eventos.',
  ideas: 'Ideas para valorar y convertir en tareas.',
  compra: 'Lista de la compra compartida.',
  recetas: 'Recetario y menú semanal.',
  gastos: 'Cuentas entre los miembros y facturas fijas.',
};

/** Si una casa usa una sección (por defecto, todas). */
export function moduleVisible(household: { hiddenModules: readonly ModuleKey[] } | null | undefined, key: ModuleKey): boolean {
  return !!household && !household.hiddenModules.includes(key);
}
