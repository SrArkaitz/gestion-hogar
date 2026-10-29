import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Equipment,
  EQUIPMENT_NAME_MAX,
  EQUIPMENT_NOTES_MAX,
  EQUIPMENT_TEXT_MAX,
  FILE_MAX_BYTES,
  INVENTORY_LOCATION_MAX,
  INVENTORY_NAME_MAX,
  INVENTORY_QUANTITY_MAX,
  INVENTORY_UNIT_MAX,
  InventoryItem,
  tidyName,
} from '@hogar/shared';
import { mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { asObject, optionalText, requiredText } from '../common/validation';
import { date } from '../expenses/expenses.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { filesDir, fileType, STORED_RE, storedName } from './files';

const toItem = (r: Prisma.InventoryItemGetPayload<object>): InventoryItem => ({
  id: r.id,
  name: r.name,
  location: r.location,
  quantity: r.quantity,
  unit: r.unit,
  minimum: r.minimum,
  updatedAt: r.updatedAt.toISOString(),
});

const include = { files: { orderBy: { createdAt: 'asc' } } } as const;
type EquipmentRow = Prisma.EquipmentGetPayload<{ include: typeof include }>;

const toEquipment = (r: EquipmentRow): Equipment => ({
  id: r.id,
  name: r.name,
  brand: r.brand,
  model: r.model,
  purchaseDate: r.purchaseDate,
  warrantyUntil: r.warrantyUntil,
  notes: r.notes,
  files: r.files.map((f) => ({ id: f.id, name: f.name, mime: f.mime, size: f.size, createdAt: f.createdAt.toISOString() })),
});

/** Inventario de una casa: lo que hay (con su mínimo) y los equipos con su garantía y sus papeles. */
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // --- Lo que hay en casa ---

  async items(householdId: string): Promise<InventoryItem[]> {
    const rows = await this.prisma.inventoryItem.findMany({ where: { householdId }, orderBy: [{ location: 'asc' }, { name: 'asc' }] });
    return rows.map(toItem);
  }

  async createItem(householdId: string, body: unknown): Promise<InventoryItem> {
    const d = validateItem(body, false);
    return toItem(await this.prisma.inventoryItem.create({ data: { householdId, name: d.name!, location: d.location ?? null, quantity: d.quantity!, unit: d.unit ?? null, minimum: d.minimum ?? null } }));
  }

  /** Cambia los campos enviados (también sirve para sumar o restar: se envía la cantidad nueva). */
  async updateItem(householdId: string, id: string, body: unknown): Promise<InventoryItem> {
    await this.findItem(householdId, id);
    return toItem(await this.prisma.inventoryItem.update({ where: { id }, data: validateItem(body, true) }));
  }

  async removeItem(householdId: string, id: string): Promise<void> {
    await this.findItem(householdId, id);
    await this.prisma.inventoryItem.delete({ where: { id } });
  }

  // --- Equipos ---

  async equipment(householdId: string): Promise<Equipment[]> {
    const rows = await this.prisma.equipment.findMany({ where: { householdId }, include, orderBy: { name: 'asc' } });
    return rows.map(toEquipment);
  }

  async createEquipment(householdId: string, body: unknown): Promise<Equipment> {
    const row = await this.prisma.equipment.create({ data: { householdId, ...validateEquipment(body) }, include });
    return toEquipment(row);
  }

  async updateEquipment(householdId: string, id: string, body: unknown): Promise<Equipment> {
    await this.findEquipment(householdId, id);
    return toEquipment(await this.prisma.equipment.update({ where: { id }, data: validateEquipment(body), include }));
  }

  /** Borra el equipo y sus archivos. */
  async removeEquipment(householdId: string, id: string): Promise<void> {
    const row = await this.findEquipment(householdId, id);
    await this.prisma.equipment.delete({ where: { id } });
    for (const f of row.files) this.deleteFile(f.file);
  }

  /** Adjunta un archivo (el cuerpo es el archivo tal cual; el nombre llega en la cabecera X-File-Name). */
  async addFile(householdId: string, id: string, data: unknown, rawName: unknown): Promise<Equipment> {
    await this.findEquipment(householdId, id);
    if (!Buffer.isBuffer(data) || !data.length) throw new BadRequestException('Falta el archivo');
    if (data.length > FILE_MAX_BYTES) throw new BadRequestException('El archivo es demasiado grande (máximo 20 MB)');
    const { mime, ext } = fileType(data);
    const name = fileLabel(rawName, ext);
    const file = storedName(ext);
    mkdirSync(filesDir(), { recursive: true });
    writeFileSync(join(filesDir(), file), data);
    await this.prisma.equipmentFile.create({ data: { equipmentId: id, name, file, mime, size: data.length } });
    return toEquipment(await this.prisma.equipment.findUniqueOrThrow({ where: { id }, include }));
  }

  /** Archivo para descargarlo: ruta en disco, nombre y tipo. */
  async file(householdId: string, id: string, fileId: string) {
    await this.findEquipment(householdId, id);
    const f = await this.prisma.equipmentFile.findFirst({ where: { id: fileId, equipmentId: id } });
    if (!f || !STORED_RE.test(f.file)) throw new NotFoundException('Ese archivo no existe');
    return { path: join(filesDir(), f.file), name: f.name, mime: f.mime };
  }

  async removeFile(householdId: string, id: string, fileId: string): Promise<Equipment> {
    await this.findEquipment(householdId, id);
    const f = await this.prisma.equipmentFile.findFirst({ where: { id: fileId, equipmentId: id } });
    if (!f) throw new NotFoundException('Ese archivo no existe');
    await this.prisma.equipmentFile.delete({ where: { id: fileId } });
    this.deleteFile(f.file);
    return toEquipment(await this.prisma.equipment.findUniqueOrThrow({ where: { id }, include }));
  }

  private deleteFile(file: string) {
    if (!STORED_RE.test(file)) return;
    try {
      unlinkSync(join(filesDir(), file));
    } catch (err) {
      this.logger.warn(`No se pudo borrar el archivo ${file}: ${(err as Error).message}`);
    }
  }

  private async findItem(householdId: string, id: string) {
    const row = await this.prisma.inventoryItem.findFirst({ where: { id, householdId } });
    if (!row) throw new NotFoundException('Eso ya no está en el inventario');
    return row;
  }

  private async findEquipment(householdId: string, id: string) {
    const row = await this.prisma.equipment.findFirst({ where: { id, householdId }, include });
    if (!row) throw new NotFoundException('Ese equipo no existe');
    return row;
  }
}

/** Nombre original del archivo, limpio de rutas y caracteres raros; si no llega, uno genérico. */
function fileLabel(raw: unknown, ext: string): string {
  let name = '';
  try {
    name = typeof raw === 'string' ? decodeURIComponent(raw) : '';
  } catch {
    name = '';
  }
  name = name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f"]/g, '').trim().slice(0, 120);
  return name || `archivo.${ext}`;
}

function amount(value: unknown, label: string, allowNull: boolean): number | null {
  if (value === null && allowNull) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > INVENTORY_QUANTITY_MAX) {
    throw new BadRequestException(`${label} no válida`);
  }
  return Math.round(value * 1000) / 1000;
}

function validateItem(body: unknown, partial: boolean) {
  const b = asObject(body);
  const has = (key: string) => b[key] !== undefined || !partial;
  const out: { name?: string; location?: string | null; quantity?: number; unit?: string | null; minimum?: number | null } = {};
  if (has('name')) out.name = tidyName(requiredText(b['name'], 'El nombre', INVENTORY_NAME_MAX));
  if (b['location'] !== undefined) {
    const loc = optionalText(b['location'], 'El sitio', INVENTORY_LOCATION_MAX);
    out.location = loc ? tidyName(loc) : null;
  }
  if (has('quantity')) out.quantity = amount(b['quantity'], 'Cantidad', false)!;
  if (b['unit'] !== undefined) out.unit = optionalText(b['unit'], 'La unidad', INVENTORY_UNIT_MAX);
  if (b['minimum'] !== undefined) out.minimum = amount(b['minimum'], 'Cantidad mínima', true);
  return out;
}

function validateEquipment(body: unknown) {
  const b = asObject(body);
  const optionalDate = (v: unknown, label: string) => (v === undefined || v === null || v === '' ? null : date(v, label));
  return {
    name: tidyName(requiredText(b['name'], 'El nombre', EQUIPMENT_NAME_MAX)),
    brand: optionalText(b['brand'], 'La marca', EQUIPMENT_TEXT_MAX),
    model: optionalText(b['model'], 'El modelo', EQUIPMENT_TEXT_MAX),
    purchaseDate: optionalDate(b['purchaseDate'], 'Fecha de compra'),
    warrantyUntil: optionalDate(b['warrantyUntil'], 'Fin de la garantía'),
    notes: optionalText(b['notes'], 'Las notas', EQUIPMENT_NOTES_MAX) ?? '',
  };
}
