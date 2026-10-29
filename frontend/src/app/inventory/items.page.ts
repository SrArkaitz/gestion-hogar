import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  INVENTORY_LOCATIONS,
  INVENTORY_LOCATION_MAX,
  INVENTORY_NAME_MAX,
  INVENTORY_UNIT_MAX,
  InventoryItem,
  isLow,
} from '@hogar/shared';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';
import { InventoryTabs } from './inventory-tabs';
import { InventoryStore } from './inventory.store';

/** Número escrito a mano ("1,5", "2") o null si no es válido. */
function parseNumber(text: string): number | null {
  const t = String(text ?? '').trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** "1,5" para mostrar en un campo. */
function numberText(n: number | null): string {
  return n === null ? '' : String(n).replace('.', ',');
}

/** Lo que hay en casa, por sitios, con lo que se acaba arriba para pasarlo a la compra. */
@Component({
  selector: 'app-items-page',
  imports: [FormsModule, RouterLink, InventoryTabs],
  host: { class: 'view' },
  templateUrl: './items.page.html',
})
export class ItemsPage {
  private readonly store = inject(InventoryStore);
  protected readonly session = inject(SessionService);

  protected readonly max = { name: INVENTORY_NAME_MAX, location: INVENTORY_LOCATION_MAX, unit: INVENTORY_UNIT_MAX };
  protected readonly number = numberText;

  protected readonly items = signal<InventoryItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly status = signal('');
  protected readonly error = signal('');

  protected readonly low = computed(() => this.items().filter(isLow));
  protected readonly isLow = isLow;
  protected readonly lowNames = computed(() => this.low().map((i) => i.name).join(', '));
  protected readonly usesShopping = computed(() => this.session.uses('compra'));

  /** Por sitio, en orden alfabético (lo que no tiene sitio, al final). */
  protected readonly groups = computed(() => {
    const map = new Map<string, InventoryItem[]>();
    for (const i of this.items()) map.set(i.location ?? '', [...(map.get(i.location ?? '') ?? []), i]);
    return [...map]
      .sort(([a], [b]) => (a ? (b ? a.localeCompare(b, 'es') : -1) : 1))
      .map(([location, items]) => ({ location: location || 'Sin sitio', items: items.sort((a, b) => a.name.localeCompare(b.name, 'es')) }));
  });
  protected readonly locationOptions = computed(() =>
    [...new Set([...INVENTORY_LOCATIONS, ...this.items().map((i) => i.location).filter((l): l is string => !!l)])].sort((a, b) => a.localeCompare(b, 'es')),
  );

  // Diálogo: undefined = cerrado, null = nuevo.
  protected readonly editing = signal<InventoryItem | null | undefined>(undefined);
  protected readonly name = signal('');
  protected readonly location = signal('');
  protected readonly quantity = signal('');
  protected readonly unit = signal('');
  protected readonly minimum = signal('');
  protected readonly formError = signal('');

  constructor() {
    effect(() => {
      if (this.session.household()?.id) void this.load();
    });
  }

  protected open(item: InventoryItem | null) {
    this.name.set(item?.name ?? '');
    this.location.set(item?.location ?? '');
    this.quantity.set(numberText(item?.quantity ?? 1));
    this.unit.set(item?.unit ?? '');
    this.minimum.set(numberText(item?.minimum ?? null));
    this.formError.set('');
    this.editing.set(item);
  }

  /** Suma o resta una unidad al momento (sin bajar de 0). */
  protected async step(item: InventoryItem, delta: number) {
    const quantity = Math.max(0, Math.round((item.quantity + delta) * 1000) / 1000);
    this.items.update((list) => list.map((i) => (i.id === item.id ? { ...i, quantity } : i)));
    try {
      await this.store.saveItem(item.id, { quantity });
    } catch (err) {
      this.items.update((list) => list.map((i) => (i.id === item.id ? item : i)));
      this.error.set(errorMessage(err, 'No se pudo cambiar la cantidad.'));
    }
  }

  protected async save() {
    const quantity = parseNumber(this.quantity());
    const minimumText = this.minimum().trim();
    const minimum = minimumText ? parseNumber(minimumText) : null;
    if (!this.name().trim()) return this.formError.set('Escribe qué es.');
    if (quantity === null) return this.formError.set('Cantidad no válida.');
    if (minimumText && minimum === null) return this.formError.set('Mínimo no válido (o déjalo vacío).');
    try {
      const saved = await this.store.saveItem(this.editing()?.id ?? null, {
        name: this.name(),
        location: this.location().trim() || null,
        quantity,
        unit: this.unit().trim() || null,
        minimum,
      });
      this.items.update((list) => [...list.filter((i) => i.id !== saved.id), saved]);
      this.editing.set(undefined);
    } catch (err) {
      this.formError.set(errorMessage(err, 'No se pudo guardar.'));
    }
  }

  protected async remove() {
    const item = this.editing();
    if (!item || !confirm(`¿Quitar «${item.name}» del inventario?`)) return;
    try {
      await this.store.removeItem(item.id);
      this.items.update((list) => list.filter((i) => i.id !== item.id));
      this.editing.set(undefined);
    } catch (err) {
      this.formError.set(errorMessage(err, 'No se pudo quitar.'));
    }
  }

  protected async toShopping() {
    const names = this.low().map((i) => i.name);
    try {
      await this.store.toShopping(names);
      this.status.set(`${names.length === 1 ? '1 cosa añadida' : `${names.length} cosas añadidas`} a la lista de la compra.`);
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo añadir a la compra.'));
    }
  }

  private async load() {
    try {
      this.items.set(await this.store.items());
      this.error.set('');
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo cargar el inventario.'));
    } finally {
      this.loading.set(false);
    }
  }
}
