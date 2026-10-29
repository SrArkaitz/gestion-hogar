/** Secciones de la app que cada casa puede ocultar. "Casa" (ajustes) no está: siempre se ve. */
export const MODULES = ['tareas', 'calendario', 'ideas', 'compra', 'recetas', 'gastos', 'inventario', 'mantenimiento'] as const;
export type ModuleKey = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  tareas: 'Tareas',
  calendario: 'Calendario',
  ideas: 'Ideas',
  compra: 'Compra',
  recetas: 'Recetas',
  gastos: 'Gastos y facturas',
  inventario: 'Inventario',
  mantenimiento: 'Mantenimiento',
};

export const MODULE_DESCRIPTIONS: Record<ModuleKey, string> = {
  tareas: 'Tablero de tareas y tareas recurrentes.',
  calendario: 'Lo que tiene fecha, cumpleaños y eventos.',
  ideas: 'Ideas para valorar y convertir en tareas (una pestaña de Tareas).',
  compra: 'Lista de la compra compartida.',
  recetas: 'Recetario y menú semanal.',
  gastos: 'Cuentas entre los miembros y facturas fijas.',
  inventario: 'Lo que hay en casa, equipos, garantías y manuales.',
  mantenimiento: 'Revisiones periódicas de la casa y el coche.',
};

/** Dirección de cada sección en la web. Ideas es una pestaña de Tareas. */
export const MODULE_PATHS: Record<ModuleKey, string> = {
  tareas: '/tareas',
  calendario: '/calendario',
  ideas: '/tareas/ideas',
  compra: '/compra',
  recetas: '/recetas',
  gastos: '/gastos',
  inventario: '/inventario',
  mantenimiento: '/mantenimiento',
};

/** Sección a la que pertenece una dirección ("/tareas/ideas" → ideas), o null si no es de ninguna. */
export function moduleForPath(url: string): ModuleKey | null {
  const path = url.split(/[?#]/)[0];
  let best: ModuleKey | null = null;
  for (const key of MODULES) {
    const p = MODULE_PATHS[key];
    if ((path === p || path.startsWith(p + '/')) && (!best || p.length > MODULE_PATHS[best].length)) best = key;
  }
  return best;
}

/** Si una casa usa una sección (por defecto, todas). */
export function moduleVisible(household: { hiddenModules: readonly ModuleKey[] } | null | undefined, key: ModuleKey): boolean {
  return !!household && !household.hiddenModules.includes(key);
}
