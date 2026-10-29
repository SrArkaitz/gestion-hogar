import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  formatAmount,
  guessSection,
  productKey,
  SHOPPING_NAME_MAX,
  SHOPPING_QUANTITY_MAX,
  SHOPPING_SECTIONS,
  ShoppingItem,
  ShoppingProduct,
  ShoppingSection,
  tidyName,
  Unit,
} from '@hogar/shared';
import { asObject, oneOf, optionalText, requiredText } from '../common/validation';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type ItemRow = Prisma.ShoppingItemGetPayload<object>;
type ProductRow = Prisma.ShoppingProductGetPayload<object>;

const toItem = (r: ItemRow): ShoppingItem => ({
  id: r.id,
  name: r.name,
  quantity: r.quantity,
  section: r.section as ShoppingSection,
  done: r.done,
  addedById: r.addedById,
  createdAt: r.createdAt.toISOString(),
});

const toProduct = (r: ProductRow): ShoppingProduct => ({
  key: r.key,
  name: r.name,
  section: r.section as ShoppingSection,
  quantity: r.quantity,
  count: r.count,
});

/** Productos que se devuelven para sugerir: de sobra para una casa. */
const PRODUCTS_LIMIT = 300;
/** Artículos como mucho en un alta en bloque. */
const BULK_MAX = 150;

interface Line {
  name: string;
  quantity: string | null;
  /** Sección elegida a mano, si la hay. */
  chosen: ShoppingSection | undefined;
}

function parseLine(b: Record<string, unknown>): Line {
  return {
    name: tidyName(requiredText(b['name'], 'El nombre', SHOPPING_NAME_MAX)),
    quantity: optionalText(b['quantity'], 'La cantidad', SHOPPING_QUANTITY_MAX),
    chosen: b['section'] === undefined ? undefined : oneOf(b['section'], SHOPPING_SECTIONS, 'Sección'),
  };
}

/** Cantidades en una magnitud común: gramos, mililitros, unidades o número suelto. */
const UNIT_BASE: Record<string, [family: string, factor: number, unit: Unit | null]> = {
  g: ['masa', 1, 'g'],
  kg: ['masa', 1000, 'g'],
  ml: ['volumen', 1, 'ml'],
  l: ['volumen', 1000, 'ml'],
  'ud.': ['unidades', 1, 'ud'],
  ud: ['unidades', 1, 'ud'],
  '': ['número', 1, null],
};

function parseQuantity(text: string): { family: string; base: number; unit: Unit | null } | null {
  const m = /^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|ud\.?)?$/i.exec(text.trim());
  if (!m) return null;
  const [family, factor, unit] = UNIT_BASE[(m[2] ?? '').toLowerCase()];
  return { family, base: Number(m[1].replace(',', '.')) * factor, unit };
}

/** Suma dos cantidades si son de la misma magnitud ("500 g" + "1 kg" = "1,5 kg"); si no, las junta. */
export function addQuantities(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  const pa = parseQuantity(a), pb = parseQuantity(b);
  if (pa && pb && pa.family === pb.family) {
    const total = pa.base + pb.base;
    if (pa.unit === 'g' && total >= 1000) return formatAmount(total / 1000, 'kg');
    if (pa.unit === 'ml' && total >= 1000) return formatAmount(total / 1000, 'l');
    return formatAmount(total, pa.unit);
  }
  const joined = `${a} + ${b}`;
  return joined.length > SHOPPING_QUANTITY_MAX ? joined.slice(0, SHOPPING_QUANTITY_MAX - 1) + '…' : joined;
}

/**
 * Lista de la compra de una casa. Cada producto que se añade queda guardado (ShoppingProduct)
 * con su sección y su última cantidad: así la próxima vez va solo a su sitio y aparece en
 * los habituales.
 */
@Injectable()
export class ShoppingService {
  constructor(private readonly prisma: PrismaService) {}

  async list(householdId: string): Promise<ShoppingItem[]> {
    const rows = await this.prisma.shoppingItem.findMany({ where: { householdId }, orderBy: { createdAt: 'asc' } });
    return rows.map(toItem);
  }

  /** Añade un producto escrito a mano (ver addOne). */
  async add(householdId: string, userId: string, body: unknown): Promise<ShoppingItem> {
    const line = parseLine(asObject(body));
    return this.prisma.$transaction((tx) => this.addOne(tx, householdId, userId, line, false));
  }

  /**
   * Añade varios de golpe (los ingredientes del menú o de una receta). Si alguno ya está pendiente
   * en la lista, las cantidades se suman: "500 g" + "1 kg" = "1,5 kg"; si no se pueden sumar,
   * se juntan: "6 bricks + 1 l".
   */
  async addMany(householdId: string, userId: string, body: unknown): Promise<ShoppingItem[]> {
    const list = asObject(body)['items'];
    if (!Array.isArray(list) || !list.length || list.length > BULK_MAX) {
      throw new BadRequestException(`items tiene que ser una lista de 1 a ${BULK_MAX} artículos`);
    }
    const lines = list.map((raw) => parseLine(asObject(raw)));
    return this.prisma.$transaction(async (tx) => {
      const items: ShoppingItem[] = [];
      for (const line of lines) items.push(await this.addOne(tx, householdId, userId, line, true));
      return items;
    });
  }

  /** Cambia los campos enviados. Cambiar la sección también la recuerda para la próxima vez. */
  async update(householdId: string, id: string, body: unknown): Promise<ShoppingItem> {
    const current = await this.find(householdId, id);
    const b = asObject(body);
    const data: { name?: string; key?: string; quantity?: string | null; section?: string; done?: boolean } = {};
    if (b['name'] !== undefined) {
      data.name = tidyName(requiredText(b['name'], 'El nombre', SHOPPING_NAME_MAX));
      data.key = productKey(data.name);
    }
    if (b['quantity'] !== undefined) data.quantity = optionalText(b['quantity'], 'La cantidad', SHOPPING_QUANTITY_MAX);
    if (b['section'] !== undefined) data.section = oneOf(b['section'], SHOPPING_SECTIONS, 'Sección');
    if (b['done'] !== undefined) {
      if (typeof b['done'] !== 'boolean') throw new BadRequestException('done tiene que ser true o false');
      data.done = b['done'];
    }

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.shoppingItem.update({ where: { id }, data });
      if (data.section || data.name) {
        const key = data.key ?? current.key;
        await tx.shoppingProduct.upsert({
          where: { householdId_key: { householdId, key } },
          create: { householdId, key, name: row.name, section: row.section, quantity: row.quantity },
          update: { name: row.name, ...(data.section && { section: data.section }) },
        });
      }
      return toItem(row);
    });
  }

  async remove(householdId: string, id: string): Promise<void> {
    await this.find(householdId, id);
    await this.prisma.shoppingItem.delete({ where: { id } });
  }

  /** Quita de la lista todo lo que ya está en el carro. @returns cuántos ha quitado. */
  async clearDone(householdId: string): Promise<number> {
    const { count } = await this.prisma.shoppingItem.deleteMany({ where: { householdId, done: true } });
    return count;
  }

  /** Productos ya comprados en la casa, de los más habituales a los menos. */
  async products(householdId: string): Promise<ShoppingProduct[]> {
    const rows = await this.prisma.shoppingProduct.findMany({
      where: { householdId },
      orderBy: [{ count: 'desc' }, { lastUsedAt: 'desc' }],
      take: PRODUCTS_LIMIT,
    });
    return rows.map(toProduct);
  }

  /** Olvida un producto (por ejemplo, uno mal escrito) para que no se sugiera más. */
  async forgetProduct(householdId: string, key: string): Promise<void> {
    await this.prisma.shoppingProduct.deleteMany({ where: { householdId, key } });
  }

  /**
   * Añade un producto. Si ya está en la lista no se repite: vuelve a "por comprar" si estaba en el
   * carro y la cantidad se cambia (o, con `sum`, se suma a la que tenía pendiente). Sin sección,
   * usa la de la última vez o la adivina.
   */
  private async addOne(tx: Prisma.TransactionClient, householdId: string, userId: string, line: Line, sum: boolean) {
    const { name, quantity, chosen } = line;
    const key = productKey(name);
    const product = await tx.shoppingProduct.findUnique({ where: { householdId_key: { householdId, key } } });
    const section = chosen ?? (product?.section as ShoppingSection | undefined) ?? guessSection(name);
    const existing = await tx.shoppingItem.findFirst({ where: { householdId, key } });

    let newQuantity = quantity;
    if (existing && !existing.done) {
      newQuantity = sum ? addQuantities(existing.quantity, quantity) : (quantity ?? existing.quantity);
    }
    const row = existing
      ? await tx.shoppingItem.update({
          where: { id: existing.id },
          data: { done: false, quantity: newQuantity, section: chosen ?? existing.section },
        })
      : await tx.shoppingItem.create({ data: { householdId, addedById: userId, name, key, quantity, section } });

    // Cuenta como una compra más si no estaba ya pendiente en la lista.
    const isNewNeed = !existing || existing.done;
    await tx.shoppingProduct.upsert({
      where: { householdId_key: { householdId, key } },
      create: { householdId, key, name, section, quantity: sum ? null : quantity },
      // El nombre se queda como estaba ("LECHE" no cambia "Leche"); solo se renombra al editar.
      // Se recuerda la cantidad escrita a mano, no la que sale de una receta.
      update: {
        section: chosen ?? undefined,
        quantity: sum ? undefined : (quantity ?? undefined),
        ...(isNewNeed && { count: { increment: 1 }, lastUsedAt: new Date() }),
      },
    });
    return toItem(row);
  }

  private async find(householdId: string, id: string) {
    const row = await this.prisma.shoppingItem.findFirst({ where: { id, householdId } });
    if (!row) throw new NotFoundException('Ese artículo ya no está en la lista');
    return row;
  }
}
