import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  guessSection,
  productKey,
  SHOPPING_NAME_MAX,
  SHOPPING_QUANTITY_MAX,
  SHOPPING_SECTIONS,
  ShoppingItem,
  ShoppingProduct,
  ShoppingSection,
  tidyName,
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

  /**
   * Añade un producto. Si ya está en la lista no se repite: vuelve a "por comprar" si estaba en el
   * carro y, si llega cantidad, se cambia. Sin sección, usa la de la última vez o la adivina.
   */
  async add(householdId: string, userId: string, body: unknown): Promise<ShoppingItem> {
    const b = asObject(body);
    const name = tidyName(requiredText(b['name'], 'El nombre', SHOPPING_NAME_MAX));
    const quantity = optionalText(b['quantity'], 'La cantidad', SHOPPING_QUANTITY_MAX);
    const chosen = b['section'] === undefined ? undefined : oneOf(b['section'], SHOPPING_SECTIONS, 'Sección');
    const key = productKey(name);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.shoppingProduct.findUnique({ where: { householdId_key: { householdId, key } } });
      const section = chosen ?? (product?.section as ShoppingSection | undefined) ?? guessSection(name);
      const existing = await tx.shoppingItem.findFirst({ where: { householdId, key } });

      const row = existing
        ? await tx.shoppingItem.update({
            where: { id: existing.id },
            data: { done: false, quantity: quantity ?? existing.quantity, section: chosen ?? existing.section },
          })
        : await tx.shoppingItem.create({ data: { householdId, addedById: userId, name, key, quantity, section } });

      // Cuenta como una compra más si no estaba ya pendiente en la lista.
      const isNewNeed = !existing || existing.done;
      await tx.shoppingProduct.upsert({
        where: { householdId_key: { householdId, key } },
        create: { householdId, key, name, section, quantity },
        // El nombre se queda como estaba ("LECHE" no cambia "Leche"); solo se renombra al editar.
        update: {
          section: chosen ?? undefined,
          quantity: quantity ?? undefined,
          ...(isNewNeed && { count: { increment: 1 }, lastUsedAt: new Date() }),
        },
      });
      return toItem(row);
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

  private async find(householdId: string, id: string) {
    const row = await this.prisma.shoppingItem.findFirst({ where: { id, householdId } });
    if (!row) throw new NotFoundException('Ese artículo ya no está en la lista');
    return row;
  }
}
