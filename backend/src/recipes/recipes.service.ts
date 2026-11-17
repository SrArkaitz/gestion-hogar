import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  Ingredient,
  INGREDIENT_NAME_MAX,
  INGREDIENT_TEXT_MAX,
  INGREDIENTS_MAX,
  MENU_TITLE_MAX,
  Recipe,
  RECIPE_DURATIONS,
  RECIPE_KINDS,
  RECIPE_MINUTES_MAX,
  RECIPE_NAME_MAX,
  RECIPE_NOTES_MAX,
  RECIPE_SEARCH_MAX,
  RECIPE_SERVINGS_MAX,
  RECIPE_SOURCE_MAX,
  RecipeDraft,
  RecipeDuration,
  RecipeInput,
  RecipeKind,
  recipeNameKey,
  STEP_MAX,
  STEPS_MAX,
  tidyName,
  Unit,
  UNITS,
} from '@hogar/shared';
import { mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { asObject, oneOf, optionalText, requiredText } from '../common/validation';
import { Prisma } from '../generated/prisma/client';
import { householdUses } from '../households/section.guard';
import { PrismaService } from '../prisma/prisma.service';
import { importRecipe } from './import';
import { PHOTO_FILE_RE, PHOTO_MAX_BYTES, photoExtension, photoFileName, photosDir } from './photos';

/** Autor, si la casa la tiene guardada y, si la tiene en favoritas, quién la marcó. */
const extras = (householdId: string) =>
  ({
    createdBy: { select: { name: true } },
    favorites: { where: { householdId }, select: { user: { select: { name: true } } } },
    saves: { where: { householdId }, select: { householdId: true } },
  }) as const;
type RowWithExtras = Prisma.RecipeGetPayload<{ include: ReturnType<typeof extras> }>;

/** La receta vista desde una casa: las suyas, completas; las de otras, con quién las apuntó. */
const toRecipe = (r: RowWithExtras, householdId: string): Recipe => ({
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
  saved: r.saves.length > 0,
  source: r.source,
  author: r.householdId !== householdId ? r.createdBy.name : null,
  favorite: r.favorites.length > 0,
  favoriteBy: r.favorites[0]?.user.name ?? null,
  createdById: r.createdById,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

/** Cantidad máxima de un ingrediente: de sobra para cualquier receta casera. */
const AMOUNT_MAX = 100_000;

/**
 * Lo que ve una casa: sus recetas y las públicas de las demás casas que usan Recetas.
 * Las de otras casas se pueden guardar y usar, pero cambiarlas es cosa de su casa.
 */
export const visibleFrom = (householdId: string): Prisma.RecipeWhereInput => ({
  OR: [{ householdId }, { private: false, household: householdUses('recetas') }],
});

/**
 * Recetario. Cada casa tiene sus recetas guardadas («Mis recetas»): las que crea o importa y las
 * públicas de otras casas que guarda. El buscador encuentra todas las que puede ver. No puede haber
 * dos recetas con el mismo nombre en toda la app. Ingredientes y pasos se guardan como JSON.
 */
@Injectable()
export class RecipesService implements OnModuleInit {
  private readonly logger = new Logger(RecipesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Las recetas de antes de los nombres únicos: les pone su clave y renombra las repetidas. */
  async onModuleInit() {
    const pending = await this.prisma.recipe.findMany({
      where: { nameKey: null },
      include: { household: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (!pending.length) return;
    const used = new Set(
      (await this.prisma.recipe.findMany({ where: { nameKey: { not: null } }, select: { nameKey: true } })).map((r) => r.nameKey!),
    );
    let renamed = 0;
    for (const r of pending) {
      let name = r.name;
      if (used.has(recipeNameKey(name))) {
        const base = `${r.name.trim()} (${r.household.name})`.slice(0, RECIPE_NAME_MAX);
        name = base;
        for (let n = 2; used.has(recipeNameKey(name)); n++) name = `${base.slice(0, RECIPE_NAME_MAX - 4)} ${n}`;
        renamed++;
      }
      used.add(recipeNameKey(name));
      await this.prisma.recipe.update({ where: { id: r.id }, data: { name, nameKey: recipeNameKey(name) } });
    }
    this.logger.log(`Nombres de recetas revisados: ${pending.length} (${renamed} renombradas por repetidas)`);
  }

  /** «Mis recetas»: las guardadas de la casa (las suyas y las públicas de otras que haya guardado). */
  async list(householdId: string): Promise<Recipe[]> {
    const rows = await this.prisma.recipe.findMany({
      where: { AND: [visibleFrom(householdId), { saves: { some: { householdId } } }] },
      include: extras(householdId),
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => toRecipe(r, householdId));
  }

  /**
   * Buscador: todas las recetas que ve la casa (las suyas, guardadas o no, y las públicas de las
   * demás), por nombre o ingrediente. Sin texto, las más nuevas.
   */
  async search(householdId: string, query: Record<string, unknown>): Promise<Recipe[]> {
    const q = typeof query['q'] === 'string' ? query['q'].trim().slice(0, RECIPE_NAME_MAX) : '';
    const kind = query['kind'] ? oneOf(query['kind'], RECIPE_KINDS, 'Tipo de plato') : undefined;
    const duration = query['duration'] ? oneOf(query['duration'], RECIPE_DURATIONS, 'Duración') : undefined;
    const rows = await this.prisma.recipe.findMany({
      where: {
        AND: [
          visibleFrom(householdId),
          q ? { OR: [{ nameKey: { contains: recipeNameKey(q) } }, { ingredients: { contains: q } }] } : {},
          kind ? { kind } : {},
          duration ? { duration } : {},
        ],
      },
      include: extras(householdId),
      orderBy: q ? { name: 'asc' } : { createdAt: 'desc' },
      take: RECIPE_SEARCH_MAX,
    });
    return rows.map((r) => toRecipe(r, householdId));
  }

  async get(householdId: string, id: string): Promise<Recipe> {
    return toRecipe(await this.findVisible(householdId, id), householdId);
  }

  /** La nueva va directamente a «Mis recetas» de la casa. */
  async create(householdId: string, createdById: string, body: unknown): Promise<Recipe> {
    const input = this.validate(body, false) as RecipeInput;
    await this.checkName(input.name);
    // Si la casa no puede publicar, las nuevas se quedan en privadas.
    if (await this.publishBlocked(householdId)) input.private = true;
    const row = await this.unique(() =>
      this.prisma.recipe.create({
        data: {
          householdId,
          createdById,
          ...stored(input),
          nameKey: recipeNameKey(input.name),
          saves: { create: { householdId, savedById: createdById } },
        },
        include: extras(householdId),
      }),
    );
    return toRecipe(row, householdId);
  }

  /** Cambia los campos enviados. Ingredientes y pasos se sustituyen enteros. */
  async update(householdId: string, id: string, body: unknown): Promise<Recipe> {
    const current = await this.find(householdId, id);
    const input = this.validate(body, true);
    if (input.private === false && (await this.publishBlocked(householdId))) {
      throw new ForbiddenException('Esta casa no puede hacer públicas sus recetas');
    }
    if (input.name !== undefined) await this.checkName(input.name, id);
    const row = await this.unique(() =>
      this.prisma.recipe.update({
        where: { id },
        data: { ...stored(input), ...(input.name !== undefined && { nameKey: recipeNameKey(input.name) }) },
        include: extras(householdId),
      }),
    );
    if (input.private && !current.private) await this.detachFromOthers(row);
    return toRecipe(row, householdId);
  }

  /** La guarda en «Mis recetas» (una de la casa que se había quitado o una pública de otra). */
  async save(householdId: string, userId: string, id: string): Promise<Recipe> {
    await this.findVisible(householdId, id);
    await this.prisma.recipeSave.upsert({
      where: { householdId_recipeId: { householdId, recipeId: id } },
      create: { householdId, recipeId: id, savedById: userId },
      update: {},
    });
    return this.get(householdId, id);
  }

  /**
   * La quita de «Mis recetas» (y de favoritas). No se borra: si es de la casa, se sigue encontrando
   * en el buscador; los platos que ya estén en el menú se quedan.
   */
  async unsave(householdId: string, id: string): Promise<Recipe> {
    await this.findVisible(householdId, id);
    await this.prisma.$transaction([
      this.prisma.recipeFavorite.deleteMany({ where: { householdId, recipeId: id } }),
      this.prisma.recipeSave.deleteMany({ where: { householdId, recipeId: id } }),
    ]);
    return this.get(householdId, id);
  }

  /** La marca (o desmarca) como favorita de la casa. Una favorita queda también guardada. */
  async setFavorite(householdId: string, userId: string, id: string, favorite: boolean): Promise<Recipe> {
    await this.findVisible(householdId, id);
    if (favorite) {
      const key = { householdId_recipeId: { householdId, recipeId: id } };
      await this.prisma.$transaction([
        this.prisma.recipeSave.upsert({ where: key, create: { householdId, recipeId: id, savedById: userId }, update: {} }),
        this.prisma.recipeFavorite.upsert({ where: key, create: { householdId, recipeId: id, userId }, update: {} }),
      ]);
    } else {
      await this.prisma.recipeFavorite.deleteMany({ where: { householdId, recipeId: id } });
    }
    return this.get(householdId, id);
  }

  /** Lee una página de recetas y devuelve lo que se ha sacado de ella, sin guardar nada. */
  importFrom(body: unknown): Promise<RecipeDraft> {
    const url = requiredText(asObject(body)['url'], 'La dirección', RECIPE_SOURCE_MAX);
    return importRecipe(url);
  }

  /** Borra la receta, su foto y sus platos del menú de esta casa (en las demás se quedan con el nombre). */
  async remove(householdId: string, id: string): Promise<void> {
    const row = await this.find(householdId, id);
    await this.detachFromOthers(row);
    await this.prisma.recipe.delete({ where: { id } });
    this.deleteFile(row.photo);
  }

  /**
   * Cuando una receta deja de verse fuera de su casa (se hace privada o se borra), los platos que
   * otras casas tenían en el menú se quedan como platos escritos a mano con su nombre.
   */
  async detachFromOthers(recipe: { id: string; householdId: string; name: string }) {
    await this.prisma.menuEntry.updateMany({
      where: { recipeId: recipe.id, householdId: { not: recipe.householdId } },
      data: { recipeId: null, title: recipe.name.slice(0, MENU_TITLE_MAX) },
    });
  }

  /** Comprueba que no hay otra receta con ese nombre en toda la app. */
  async checkName(name: string, exceptId?: string) {
    const other = await this.prisma.recipe.findFirst({
      where: { nameKey: recipeNameKey(name), ...(exceptId && { id: { not: exceptId } }) },
      select: { id: true },
    });
    if (other) throw nameTaken(name);
  }

  /** Guarda una foto nueva (la anterior se borra). */
  async setPhoto(householdId: string, id: string, data: unknown): Promise<Recipe> {
    const row = await this.find(householdId, id);
    if (!Buffer.isBuffer(data) || !data.length) throw new BadRequestException('Falta la foto');
    if (data.length > PHOTO_MAX_BYTES) throw new BadRequestException('La foto es demasiado grande');
    const file = photoFileName(id, photoExtension(data));
    mkdirSync(photosDir(), { recursive: true });
    writeFileSync(join(photosDir(), file), data);
    const updated = await this.prisma.recipe.update({ where: { id }, data: { photo: file }, include: extras(householdId) });
    this.deleteFile(row.photo);
    return toRecipe(updated, householdId);
  }

  async removePhoto(householdId: string, id: string): Promise<Recipe> {
    const row = await this.find(householdId, id);
    const updated = await this.prisma.recipe.update({ where: { id }, data: { photo: null }, include: extras(householdId) });
    this.deleteFile(row.photo);
    return toRecipe(updated, householdId);
  }

  /** Ruta del archivo de la foto, o 404 si la receta no tiene. */
  async photoPath(householdId: string, id: string): Promise<string> {
    const row = await this.findVisible(householdId, id);
    if (!row.photo || !PHOTO_FILE_RE.test(row.photo)) throw new NotFoundException('La receta no tiene foto');
    return join(photosDir(), row.photo);
  }

  /** Borra un archivo de foto (también lo usa la moderación). */
  deleteFile(file: string | null) {
    if (!file || !PHOTO_FILE_RE.test(file)) return;
    try {
      unlinkSync(join(photosDir(), file));
    } catch (err) {
      this.logger.warn(`No se pudo borrar la foto ${file}: ${(err as Error).message}`);
    }
  }

  /** Si otra petición se ha adelantado con el mismo nombre, el índice único lo para: mismo mensaje. */
  private async unique<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Ya hay una receta con ese nombre. Ponle uno que la distinga.');
      }
      throw err;
    }
  }

  private async publishBlocked(householdId: string): Promise<boolean> {
    const h = await this.prisma.household.findUnique({ where: { id: householdId }, select: { publishBlockedAt: true } });
    return !!h?.publishBlockedAt;
  }

  /** Una receta de esta casa o una pública de otra. */
  private async findVisible(householdId: string, id: string) {
    const row = await this.prisma.recipe.findFirst({ where: { id, ...visibleFrom(householdId) }, include: extras(householdId) });
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

    if (has('name')) out.name = recipeName(b['name']);
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
    if (b['source'] !== undefined) out.source = source(b['source']);
    return out;
  }
}

/** Nombre de una receta, ordenado ("lentejas" → "Lentejas"). También lo usa la moderación. */
export function recipeName(value: unknown): string {
  return tidyName(requiredText(value, 'El nombre', RECIPE_NAME_MAX));
}

export function nameTaken(name: string): ConflictException {
  return new ConflictException(`Ya hay una receta que se llama «${name}». Ponle un nombre que la distinga (por ejemplo, «${name} de la abuela»).`);
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

/** Dirección de la página de origen: solo http(s). */
function source(value: unknown): string | null {
  const text = optionalText(value, 'La dirección de origen', RECIPE_SOURCE_MAX);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
  } catch {
    // Cae al error de abajo.
  }
  throw new BadRequestException('La dirección de origen no es válida');
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
