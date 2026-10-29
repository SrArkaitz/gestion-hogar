import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Ingredient,
  INGREDIENT_NAME_MAX,
  INGREDIENT_TEXT_MAX,
  INGREDIENTS_MAX,
  Recipe,
  RECIPE_DURATIONS,
  RECIPE_KINDS,
  RECIPE_MINUTES_MAX,
  RECIPE_NAME_MAX,
  RECIPE_NOTES_MAX,
  RECIPE_SERVINGS_MAX,
  RecipeDuration,
  RecipeInput,
  RecipeKind,
  STEP_MAX,
  STEPS_MAX,
  tidyName,
  Unit,
  UNITS,
} from '@hogar/shared';
import { copyFileSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { asObject, oneOf, optionalText, requiredText } from '../common/validation';
import { Prisma } from '../generated/prisma/client';
import { householdUses } from '../households/section.guard';
import { PrismaService } from '../prisma/prisma.service';
import { PHOTO_FILE_RE, PHOTO_MAX_BYTES, photoExtension, photoFileName, photosDir } from './photos';

type Row = Prisma.RecipeGetPayload<object>;
type RowWithAuthor = Prisma.RecipeGetPayload<{ include: { createdBy: { select: { name: true } } } }>;

const withAuthor = { createdBy: { select: { name: true } } } as const;

/** La receta vista desde una casa: las suyas, completas; las de otras, con quién las apuntó. */
const toRecipe = (r: Row | RowWithAuthor, householdId: string): Recipe => ({
  id: r.id,
  name: r.name,
  kind: r.kind as RecipeKind,
  duration: r.duration as RecipeDuration,
  minutes: r.minutes,
  servings: r.servings,
  ingredients: JSON.parse(r.ingredients) as Ingredient[],
  steps: JSON.parse(r.steps) as string[],
  notes: r.notes,
  photo: r.photo,
  private: r.private,
  mine: r.householdId === householdId,
  author: r.householdId !== householdId && 'createdBy' in r ? r.createdBy.name : null,
  createdById: r.createdById,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

/** Cantidad máxima de un ingrediente: de sobra para cualquier receta casera. */
const AMOUNT_MAX = 100_000;

/**
 * Lo que ve una casa: sus recetas y las públicas de las demás casas que usan Recetas.
 * Las de otras casas solo se leen (o se copian); cambiarlas es cosa de su casa.
 */
const visibleFrom = (householdId: string): Prisma.RecipeWhereInput => ({
  OR: [{ householdId }, { private: false, household: householdUses('recetas') }],
});

/** Recetario de una casa. Ingredientes y pasos se guardan como JSON dentro de la receta. */
@Injectable()
export class RecipesService {
  private readonly logger = new Logger(RecipesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(householdId: string): Promise<Recipe[]> {
    const rows = await this.prisma.recipe.findMany({ where: visibleFrom(householdId), include: withAuthor, orderBy: { name: 'asc' } });
    return rows.map((r) => toRecipe(r, householdId));
  }

  async get(householdId: string, id: string): Promise<Recipe> {
    return toRecipe(await this.findVisible(householdId, id), householdId);
  }

  /**
   * Copia a esta casa una receta pública de otra, con su foto. La copia es privada: la original ya
   * la ven todos y así no sale repetida en las demás casas.
   */
  async copy(householdId: string, createdById: string, id: string): Promise<Recipe> {
    const from = await this.findVisible(householdId, id);
    if (from.householdId === householdId) throw new BadRequestException('La receta ya es de esta casa');
    const { name, kind, duration, minutes, servings, ingredients, steps, notes } = from;
    const row = await this.prisma.recipe.create({
      data: { householdId, createdById, name, kind, duration, minutes, servings, ingredients, steps, notes, private: true },
    });
    if (!from.photo || !PHOTO_FILE_RE.test(from.photo)) return toRecipe(row, householdId);
    try {
      const file = photoFileName(row.id, from.photo.split('.').pop()!);
      copyFileSync(join(photosDir(), from.photo), join(photosDir(), file));
      return toRecipe(await this.prisma.recipe.update({ where: { id: row.id }, data: { photo: file } }), householdId);
    } catch (err) {
      this.logger.warn(`No se pudo copiar la foto ${from.photo}: ${(err as Error).message}`);
      return toRecipe(row, householdId);
    }
  }

  async create(householdId: string, createdById: string, body: unknown): Promise<Recipe> {
    const input = this.validate(body, false) as RecipeInput;
    const row = await this.prisma.recipe.create({ data: { householdId, createdById, ...stored(input) } });
    return toRecipe(row, householdId);
  }

  /** Cambia los campos enviados. Ingredientes y pasos se sustituyen enteros. */
  async update(householdId: string, id: string, body: unknown): Promise<Recipe> {
    await this.find(householdId, id);
    const row = await this.prisma.recipe.update({ where: { id }, data: stored(this.validate(body, true)) });
    return toRecipe(row, householdId);
  }

  /** Borra la receta, su foto y sus platos del menú. */
  async remove(householdId: string, id: string): Promise<void> {
    const row = await this.find(householdId, id);
    await this.prisma.recipe.delete({ where: { id } });
    this.deleteFile(row.photo);
  }

  /** Guarda una foto nueva (la anterior se borra). */
  async setPhoto(householdId: string, id: string, data: unknown): Promise<Recipe> {
    const row = await this.find(householdId, id);
    if (!Buffer.isBuffer(data) || !data.length) throw new BadRequestException('Falta la foto');
    if (data.length > PHOTO_MAX_BYTES) throw new BadRequestException('La foto es demasiado grande');
    const file = photoFileName(id, photoExtension(data));
    mkdirSync(photosDir(), { recursive: true });
    writeFileSync(join(photosDir(), file), data);
    const updated = await this.prisma.recipe.update({ where: { id }, data: { photo: file } });
    this.deleteFile(row.photo);
    return toRecipe(updated, householdId);
  }

  async removePhoto(householdId: string, id: string): Promise<Recipe> {
    const row = await this.find(householdId, id);
    const updated = await this.prisma.recipe.update({ where: { id }, data: { photo: null } });
    this.deleteFile(row.photo);
    return toRecipe(updated, householdId);
  }

  /** Ruta del archivo de la foto, o 404 si la receta no tiene. */
  async photoPath(householdId: string, id: string): Promise<string> {
    const row = await this.findVisible(householdId, id);
    if (!row.photo || !PHOTO_FILE_RE.test(row.photo)) throw new NotFoundException('La receta no tiene foto');
    return join(photosDir(), row.photo);
  }

  private deleteFile(file: string | null) {
    if (!file || !PHOTO_FILE_RE.test(file)) return;
    try {
      unlinkSync(join(photosDir(), file));
    } catch (err) {
      this.logger.warn(`No se pudo borrar la foto ${file}: ${(err as Error).message}`);
    }
  }

  /** Una receta de esta casa o una pública de otra. */
  private async findVisible(householdId: string, id: string) {
    const row = await this.prisma.recipe.findFirst({ where: { id, ...visibleFrom(householdId) }, include: withAuthor });
    if (!row) throw new NotFoundException('La receta no existe');
    return row;
  }

  /** Una receta de esta casa: las únicas que se pueden cambiar. */
  private async find(householdId: string, id: string) {
    const row = await this.prisma.recipe.findFirst({ where: { id, householdId } });
    if (!row) throw new NotFoundException('La receta no existe');
    return row;
  }

  private validate(body: unknown, partial: boolean): Partial<RecipeInput> {
    const b = asObject(body);
    const out: Partial<RecipeInput> = {};
    const has = (key: string) => b[key] !== undefined || !partial;

    if (has('name')) out.name = tidyName(requiredText(b['name'], 'El nombre', RECIPE_NAME_MAX));
    if (has('kind')) out.kind = oneOf(b['kind'], RECIPE_KINDS, 'Tipo de plato');
    if (has('duration')) out.duration = oneOf(b['duration'], RECIPE_DURATIONS, 'Duración');
    if (b['minutes'] !== undefined) {
      out.minutes = b['minutes'] === null ? null : integer(b['minutes'], 'Los minutos', 1, RECIPE_MINUTES_MAX);
    }
    if (has('servings')) out.servings = integer(b['servings'], 'Las raciones', 1, RECIPE_SERVINGS_MAX);
    if (has('ingredients')) out.ingredients = ingredients(b['ingredients']);
    if (has('steps')) out.steps = steps(b['steps']);
    if (b['private'] !== undefined) {
      if (typeof b['private'] !== 'boolean') throw new BadRequestException('«Privada» tiene que ser sí o no');
      out.private = b['private'];
    }
    if (b['notes'] !== undefined) out.notes = optionalText(b['notes'], 'Las notas', RECIPE_NOTES_MAX) ?? '';
    return out;
  }
}

/** Campos tal como van a la base de datos: ingredientes y pasos en JSON. */
function stored<T extends Partial<RecipeInput>>(input: T): Omit<T, 'ingredients' | 'steps'> & { ingredients?: string; steps?: string } {
  const { ingredients, steps, ...rest } = input;
  return {
    ...rest,
    ...(ingredients && { ingredients: JSON.stringify(ingredients) }),
    ...(steps && { steps: JSON.stringify(steps) }),
  };
}

function integer(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException(`${label} tienen que ser un número entre ${min} y ${max}`);
  }
  return value;
}

function ingredients(value: unknown): Ingredient[] {
  if (!Array.isArray(value)) throw new BadRequestException('Los ingredientes tienen que ser una lista');
  if (value.length > INGREDIENTS_MAX) throw new BadRequestException(`Como mucho ${INGREDIENTS_MAX} ingredientes`);
  return value.map((raw, i) => {
    const o = asObject(raw);
    const label = `Ingrediente ${i + 1}`;
    const name = tidyName(requiredText(o['name'], `El nombre del ingrediente ${i + 1}`, INGREDIENT_NAME_MAX));
    let amount: number | null = null;
    let unit: Unit | null = null;
    if (o['amount'] !== null && o['amount'] !== undefined) {
      const n = o['amount'];
      if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > AMOUNT_MAX) {
        throw new BadRequestException(`${label}: cantidad no válida`);
      }
      amount = n;
      unit = o['unit'] === null || o['unit'] === undefined ? null : oneOf(o['unit'], UNITS, `${label}: unidad`);
    }
    // Con cantidad no hace falta texto; sin ella, el texto ("al gusto") es lo que se muestra.
    const text = amount === null ? optionalText(o['text'], `${label}: texto`, INGREDIENT_TEXT_MAX) : null;
    return { name, amount, unit, text };
  });
}

function steps(value: unknown): string[] {
  if (!Array.isArray(value)) throw new BadRequestException('Los pasos tienen que ser una lista');
  const list = value.map((s, i) => optionalText(s, `El paso ${i + 1}`, STEP_MAX)).filter((s): s is string => !!s);
  if (list.length > STEPS_MAX) throw new BadRequestException(`Como mucho ${STEPS_MAX} pasos`);
  return list;
}
