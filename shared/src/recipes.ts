import { IsoDate } from './common';
import { addDays, isoWeekday } from './recurring';
import { productKey, tidyName } from './shopping';

export const RECIPE_KINDS = ['primero', 'segundo', 'unico', 'postre'] as const;
export type RecipeKind = (typeof RECIPE_KINDS)[number];
export const RECIPE_KIND_LABELS: Record<RecipeKind, string> = {
  primero: 'Primer plato',
  segundo: 'Segundo plato',
  unico: 'Plato único',
  postre: 'Postre',
};

/** Duración por tramos, siempre presente; los minutos exactos son opcionales. */
export const RECIPE_DURATIONS = ['rapido', 'medio', 'largo'] as const;
export type RecipeDuration = (typeof RECIPE_DURATIONS)[number];
export const RECIPE_DURATION_LABELS: Record<RecipeDuration, string> = { rapido: 'Rápido', medio: 'Medio', largo: 'Largo' };

export const UNITS = ['g', 'kg', 'ml', 'l', 'ud'] as const;
export type Unit = (typeof UNITS)[number];
export const UNIT_LABELS: Record<Unit, string> = { g: 'g', kg: 'kg', ml: 'ml', l: 'l', ud: 'ud.' };

export const MEALS = ['comida', 'cena'] as const;
export type Meal = (typeof MEALS)[number];
export const MEAL_LABELS: Record<Meal, string> = { comida: 'Comida', cena: 'Cena' };

export const RECIPE_NAME_MAX = 100;
export const RECIPE_SERVINGS_MAX = 50;
export const RECIPE_MINUTES_MAX = 24 * 60;
export const INGREDIENTS_MAX = 60;
export const INGREDIENT_NAME_MAX = 80;
export const INGREDIENT_TEXT_MAX = 40;
export const STEPS_MAX = 50;
export const STEP_MAX = 1000;
export const RECIPE_NOTES_MAX = 2000;

/**
 * Ingrediente: cantidad con unidad ("200 g") o texto libre ("al gusto", "un chorrito").
 * Si no tiene ninguna de las dos, solo se apunta el nombre.
 */
export interface Ingredient {
  name: string;
  amount: number | null;
  unit: Unit | null;
  text: string | null;
}

export interface Recipe {
  id: string;
  name: string;
  kind: RecipeKind;
  duration: RecipeDuration;
  minutes: number | null;
  /** Raciones para las que están pensadas las cantidades. */
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  notes: string;
  /** Nombre del archivo de la foto (cambia con cada foto nueva), o null. */
  photo: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeInput {
  name: string;
  kind: RecipeKind;
  duration: RecipeDuration;
  minutes?: number | null;
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  notes?: string;
}

/** Un plato en el menú: un día, comida o cena, y para cuántas raciones. */
export interface MenuEntry {
  id: string;
  date: IsoDate;
  meal: Meal;
  recipeId: string;
  servings: number;
}

export interface MenuEntryInput {
  date: IsoDate;
  meal: Meal;
  recipeId: string;
  servings: number;
}

/** Línea para la lista de la compra: nombre y cantidad ya sumada. */
export interface ShoppingLine {
  key: string;
  name: string;
  quantity: string | null;
}

/** Lunes de la semana de esa fecha. */
export function startOfWeek(date: IsoDate): IsoDate {
  return addDays(date, 1 - isoWeekday(date));
}

/** "200 g", "1,5 kg", "3 ud.". Redondea: gramos y mililitros a la unidad desde 10. */
export function formatAmount(amount: number, unit: Unit | null): string {
  const rounded =
    (unit === 'g' || unit === 'ml') && amount >= 10 ? Math.round(amount) : Math.round(amount * 100) / 100;
  const text = rounded.toLocaleString('es-ES', { maximumFractionDigits: 2 });
  return unit ? `${text} ${UNIT_LABELS[unit]}` : text;
}

/** Cantidad de un ingrediente multiplicada por `factor` (raciones nuevas / raciones de la receta). */
export function ingredientQuantity(ingredient: Ingredient, factor = 1): string | null {
  if (ingredient.amount !== null) return formatAmount(ingredient.amount * factor, ingredient.unit);
  return ingredient.text;
}

/**
 * Suma los ingredientes de varias recetas (cada una con su factor de raciones) para la compra:
 * una línea por ingrediente, con las cantidades de la misma magnitud sumadas (200 g + 1 kg =
 * 1,2 kg) y las unidades redondeadas hacia arriba. Los que solo llevan texto ("al gusto") pasan
 * sin cantidad.
 */
export function shoppingLines(dishes: { ingredients: Ingredient[]; factor: number }[]): ShoppingLine[] {
  const byKey = new Map<string, { name: string; mass: number; volume: number; units: number; plain: number }>();
  for (const { ingredients, factor } of dishes) {
    for (const ing of ingredients) {
      const key = productKey(ing.name);
      if (!key) continue;
      let line = byKey.get(key);
      if (!line) {
        line = { name: tidyName(ing.name), mass: 0, volume: 0, units: 0, plain: 0 };
        byKey.set(key, line);
      }
      if (ing.amount === null) continue;
      const amount = ing.amount * factor;
      switch (ing.unit) {
        case 'g': line.mass += amount; break;
        case 'kg': line.mass += amount * 1000; break;
        case 'ml': line.volume += amount; break;
        case 'l': line.volume += amount * 1000; break;
        case 'ud': line.units += amount; break;
        default: line.plain += amount;
      }
    }
  }
  return [...byKey].map(([key, l]) => {
    const parts = [
      l.mass && (l.mass >= 1000 ? formatAmount(l.mass / 1000, 'kg') : formatAmount(l.mass, 'g')),
      l.volume && (l.volume >= 1000 ? formatAmount(l.volume / 1000, 'l') : formatAmount(l.volume, 'ml')),
      // En la compra no hay medios huevos: las unidades se redondean hacia arriba.
      l.units && formatAmount(roundUp(l.units), 'ud'),
      l.plain && formatAmount(roundUp(l.plain), null),
    ].filter(Boolean);
    return { key, name: l.name, quantity: parts.length ? parts.join(' + ') : null };
  });
}

/** Hacia arriba, sin que 2,0000001 (errores de coma flotante al escalar) se convierta en 3. */
function roundUp(n: number): number {
  return Math.ceil(n - 1e-9);
}
