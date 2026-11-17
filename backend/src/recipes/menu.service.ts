import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isIsoDate, Meal, MEALS, MENU_TITLE_MAX, MenuEntry, MenuSettings, RECIPE_SERVINGS_MAX } from '@hogar/shared';
import { asObject, oneOf, requiredText } from '../common/validation';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { visibleFrom } from './recipes.service';

type Row = Prisma.MenuEntryGetPayload<object>;

const toEntry = (r: Row): MenuEntry => ({
  id: r.id,
  date: r.date,
  meal: r.meal as Meal,
  recipeId: r.recipeId,
  title: r.title,
  servings: r.servings,
});

/** Días como mucho que se piden de una vez (una semana con margen). */
const RANGE_MAX_DAYS = 62;

/** Menú semanal: platos por día y comida (puede haber varios: primero, segundo, postre…). */
@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async list(householdId: string, from: unknown, to: unknown): Promise<MenuEntry[]> {
    const start = date(from, 'from'), end = date(to, 'to');
    const days = (Date.parse(end) - Date.parse(start)) / 86_400_000;
    if (days < 0 || days > RANGE_MAX_DAYS) throw new BadRequestException(`Rango de fechas no válido (máximo ${RANGE_MAX_DAYS} días)`);
    const rows = await this.prisma.menuEntry.findMany({
      where: { householdId, date: { gte: start, lte: end } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toEntry);
  }

  /** Con recipeId, una receta que vea la casa (suya o pública de otra); sin él, un plato escrito a mano (title). */
  async create(householdId: string, body: unknown): Promise<MenuEntry> {
    const b = asObject(body);
    if (b['recipeId'] === undefined || b['recipeId'] === null) {
      const row = await this.prisma.menuEntry.create({
        data: {
          householdId,
          title: requiredText(b['title'], 'El plato', MENU_TITLE_MAX),
          date: date(b['date'], 'date'),
          meal: oneOf(b['meal'], MEALS, 'Comida o cena'),
          servings: b['servings'] === undefined ? 1 : servings(b['servings']),
        },
      });
      return toEntry(row);
    }
    const recipeId = b['recipeId'];
    const recipe =
      typeof recipeId === 'string' && (await this.prisma.recipe.findFirst({ where: { id: recipeId, ...visibleFrom(householdId) } }));
    if (!recipe) throw new BadRequestException('Esa receta no existe');
    const row = await this.prisma.menuEntry.create({
      data: {
        householdId,
        recipeId: recipe.id,
        date: date(b['date'], 'date'),
        meal: oneOf(b['meal'], MEALS, 'Comida o cena'),
        servings: b['servings'] === undefined ? recipe.servings : servings(b['servings']),
      },
    });
    return toEntry(row);
  }

  async settings(householdId: string): Promise<MenuSettings> {
    const h = await this.prisma.household.findUniqueOrThrow({ where: { id: householdId }, select: { menuInCalendar: true } });
    return { inCalendar: h.menuInCalendar };
  }

  /** Cualquiera de la casa puede elegir si el menú sale en el calendario. */
  async setSettings(householdId: string, body: unknown): Promise<MenuSettings> {
    const value = asObject(body)['inCalendar'];
    if (typeof value !== 'boolean') throw new BadRequestException('inCalendar tiene que ser true o false');
    await this.prisma.household.update({ where: { id: householdId }, data: { menuInCalendar: value } });
    return { inCalendar: value };
  }

  /** Cambia las raciones, mueve el plato a otro día o comida o, si no lleva receta, cambia su nombre. */
  async update(householdId: string, id: string, body: unknown): Promise<MenuEntry> {
    const current = await this.find(householdId, id);
    const b = asObject(body);
    if (b['title'] !== undefined && current.recipeId) throw new BadRequestException('Un plato con receta lleva el nombre de la receta');
    const row = await this.prisma.menuEntry.update({
      where: { id },
      data: {
        ...(b['servings'] !== undefined && { servings: servings(b['servings']) }),
        ...(b['date'] !== undefined && { date: date(b['date'], 'date') }),
        ...(b['meal'] !== undefined && { meal: oneOf(b['meal'], MEALS, 'Comida o cena') }),
        ...(b['title'] !== undefined && { title: requiredText(b['title'], 'El plato', MENU_TITLE_MAX) }),
      },
    });
    return toEntry(row);
  }

  async remove(householdId: string, id: string): Promise<void> {
    await this.find(householdId, id);
    await this.prisma.menuEntry.delete({ where: { id } });
  }

  private async find(householdId: string, id: string) {
    const row = await this.prisma.menuEntry.findFirst({ where: { id, householdId } });
    if (!row) throw new NotFoundException('Ese plato ya no está en el menú');
    return row;
  }
}

function date(value: unknown, label: string): string {
  if (!isIsoDate(value)) {
    throw new BadRequestException(`Fecha no válida en ${label} (AAAA-MM-DD)`);
  }
  return value;
}

function servings(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > RECIPE_SERVINGS_MAX) {
    throw new BadRequestException(`Las raciones tienen que ser un número entre 1 y ${RECIPE_SERVINGS_MAX}`);
  }
  return value;
}
