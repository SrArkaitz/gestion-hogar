import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ISO_DATE_RE, Meal, MEALS, MenuEntry, RECIPE_SERVINGS_MAX } from '@hogar/shared';
import { asObject, oneOf } from '../common/validation';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Row = Prisma.MenuEntryGetPayload<object>;

const toEntry = (r: Row): MenuEntry => ({
  id: r.id,
  date: r.date,
  meal: r.meal as Meal,
  recipeId: r.recipeId,
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

  async create(householdId: string, body: unknown): Promise<MenuEntry> {
    const b = asObject(body);
    const recipeId = b['recipeId'];
    const recipe =
      typeof recipeId === 'string' && (await this.prisma.recipe.findFirst({ where: { id: recipeId, householdId } }));
    if (!recipe) throw new BadRequestException('Esa receta no es de esta casa');
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

  /** Cambia las raciones o mueve el plato a otro día o comida. */
  async update(householdId: string, id: string, body: unknown): Promise<MenuEntry> {
    await this.find(householdId, id);
    const b = asObject(body);
    const row = await this.prisma.menuEntry.update({
      where: { id },
      data: {
        ...(b['servings'] !== undefined && { servings: servings(b['servings']) }),
        ...(b['date'] !== undefined && { date: date(b['date'], 'date') }),
        ...(b['meal'] !== undefined && { meal: oneOf(b['meal'], MEALS, 'Comida o cena') }),
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
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
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
