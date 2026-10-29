import { Cents } from './expenses';
import { IsoDate } from './common';

/** Sitios que se sugieren para guardar las cosas; se puede escribir otro. */
export const INVENTORY_LOCATIONS = ['Despensa', 'Nevera', 'Congelador', 'Limpieza', 'Baño', 'Botiquín', 'Trastero'] as const;

export const INVENTORY_NAME_MAX = 80;
export const INVENTORY_LOCATION_MAX = 40;
export const INVENTORY_UNIT_MAX = 15;
export const INVENTORY_QUANTITY_MAX = 100_000;

/** Algo que hay en casa (despensa, limpieza…). */
export interface InventoryItem {
  id: string;
  name: string;
  location: string | null;
  quantity: number;
  /** "ud.", "kg", "paquetes"… */
  unit: string | null;
  /** Con esto o menos, "se acaba". null: no avisa. */
  minimum: number | null;
  updatedAt: string;
}

export interface InventoryItemInput {
  name: string;
  location?: string | null;
  quantity: number;
  unit?: string | null;
  minimum?: number | null;
}

/** Se está acabando: tiene mínimo y no lo supera. */
export function isLow(item: Pick<InventoryItem, 'quantity' | 'minimum'>): boolean {
  return item.minimum !== null && item.quantity <= item.minimum;
}

export const EQUIPMENT_NAME_MAX = 80;
export const EQUIPMENT_TEXT_MAX = 80;
export const EQUIPMENT_NOTES_MAX = 2000;
/** Tamaño máximo de un archivo adjunto (manual, factura…). */
export const FILE_MAX_BYTES = 20 * 1024 * 1024;
/** Tipos de archivo admitidos. */
export const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;

export interface EquipmentFile {
  id: string;
  /** Nombre original del archivo. */
  name: string;
  mime: string;
  size: number;
  createdAt: string;
}

/** Electrodoméstico, aparato o vehículo con su garantía y sus papeles. */
export interface Equipment {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  purchaseDate: IsoDate | null;
  warrantyUntil: IsoDate | null;
  notes: string;
  files: EquipmentFile[];
}

export interface EquipmentInput {
  name: string;
  brand?: string | null;
  model?: string | null;
  purchaseDate?: IsoDate | null;
  warrantyUntil?: IsoDate | null;
  notes?: string;
}

// --- Mantenimiento ---

/** Grupos que se sugieren; se puede escribir otro. */
export const MAINTENANCE_GROUPS = ['Casa', 'Coche', 'Jardín', 'Electrodomésticos'] as const;
export const MAINTENANCE_NAME_MAX = 80;
export const MAINTENANCE_NOTES_MAX = 2000;
export const MAINTENANCE_INTERVAL_MAX = 120;
export const MAINTENANCE_NOTICE_MAX = 60;

/** Revisión periódica (ITV, caldera, filtros…). */
export interface Maintenance {
  id: string;
  name: string;
  group: string | null;
  /** Cada cuántos meses; null si no se repite. */
  interval: number | null;
  /** Próxima vez; null si no hay fecha (por ejemplo, una que no se repite y ya se hizo). */
  nextDue: IsoDate | null;
  /** Con cuántos días de antelación avisar. */
  notifyDays: number;
  notes: string;
  /** Última vez que se hizo, si consta. */
  lastDone: IsoDate | null;
}

export interface MaintenanceInput {
  name: string;
  group?: string | null;
  interval?: number | null;
  nextDue?: IsoDate | null;
  notifyDays?: number;
  notes?: string;
}

/** Una vez que se hizo, con su coste si lo tuvo. */
export interface MaintenanceLog {
  id: string;
  date: IsoDate;
  notes: string;
  cost: Cents | null;
}

export interface MaintenanceDoneInput {
  date: IsoDate;
  notes?: string;
  cost?: Cents | null;
}
