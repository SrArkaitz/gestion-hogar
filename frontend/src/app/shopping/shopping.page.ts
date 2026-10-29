import { Component, ElementRef, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  guessSection,
  productKey,
  SHOPPING_NAME_MAX,
  SHOPPING_QUANTITY_MAX,
  SHOPPING_SECTION_LABELS,
  SHOPPING_SECTIONS,
  ShoppingItem,
  ShoppingItemPatch,
  ShoppingProduct,
} from '@hogar/shared';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';
import { ItemDialog } from './item-dialog';
import { ShoppingStore } from './shopping.store';

/** Habituales que se ofrecen con un toque cuando no se está escribiendo. */
const FAVOURITES = 12;
/** Sugerencias mientras se escribe. */
const SUGGESTIONS = 6;

@Component({
  selector: 'app-shopping-page',
  imports: [FormsModule, ItemDialog],
  host: { class: 'view' },
  templateUrl: './shopping.page.html',
})
export class ShoppingPage implements OnDestroy {
  protected readonly store = inject(ShoppingStore);
  private readonly session = inject(SessionService);

  protected readonly sectionLabels = SHOPPING_SECTION_LABELS;
  protected readonly nameMax = SHOPPING_NAME_MAX;
  protected readonly quantityMax = SHOPPING_QUANTITY_MAX;

  protected readonly name = signal('');
  protected readonly quantity = signal('');
  protected readonly status = signal('');
  protected readonly editing = signal<ShoppingItem | null>(null);
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly dialog = viewChild(ItemDialog);
  private readonly householdId = computed(() => this.session.household()?.id);

  /** Lo que ya está en la lista, pendiente o en el carro: no tiene sentido sugerirlo. */
  private readonly listedKeys = computed(() => new Set(this.store.items().map((i) => productKey(i.name))));
  protected readonly pendingCount = computed(() => this.store.items().filter((i) => !i.done).length);

  /** Lo pendiente, por secciones del súper y dentro de cada una por orden de llegada. */
  protected readonly groups = computed(() =>
    SHOPPING_SECTIONS.map((section) => ({
      section,
      label: SHOPPING_SECTION_LABELS[section],
      items: this.store.items().filter((i) => !i.done && i.section === section),
    })).filter((g) => g.items.length),
  );
  protected readonly inCart = computed(() => this.store.items().filter((i) => i.done));

  /** Productos ya comprados que no están en la lista, de los más habituales a los menos. */
  private readonly available = computed(() => this.store.products().filter((p) => !this.listedKeys().has(p.key)));
  protected readonly favourites = computed(() => this.available().slice(0, FAVOURITES));

  /** Mientras se escribe: primero los que empiezan así y luego los que lo contienen. */
  protected readonly suggestions = computed(() => {
    const q = productKey(this.name());
    if (!q) return [];
    const matches = this.available().filter((p) => p.key.includes(q) && p.key !== q);
    return [...matches.filter((p) => p.key.startsWith(q)), ...matches.filter((p) => !p.key.startsWith(q))].slice(0, SUGGESTIONS);
  });

  /** A qué sección irá lo que se está escribiendo (si hay sugerencias, ya dicen la suya). */
  protected readonly target = computed(() => {
    const name = this.name().trim();
    if (!name || this.suggestions().length) return null;
    const known = this.store.products().find((p) => p.key === productKey(name));
    return SHOPPING_SECTION_LABELS[known?.section ?? guessSection(name)];
  });

  constructor() {
    effect(() => {
      const id = this.householdId();
      if (id) this.store.load(id);
    });
    this.store.startSync();
  }

  ngOnDestroy() {
    this.store.stopSync();
  }

  protected async add() {
    const name = this.name().trim();
    if (!name) return;
    await this.run(async () => {
      await this.store.add({ name, quantity: this.quantity().trim() || null });
      this.name.set('');
      this.quantity.set('');
      this.nameInput()?.nativeElement.focus();
    });
  }

  protected async addProduct(product: ShoppingProduct) {
    await this.run(async () => {
      await this.store.add({ name: product.name, quantity: product.quantity });
      this.name.set('');
    });
  }

  protected async forget(product: ShoppingProduct) {
    await this.run(() => this.store.forgetProduct(product.key));
  }

  protected async toggle(item: ShoppingItem) {
    await this.run(() => this.store.toggle(item));
  }

  protected async clearDone() {
    const n = this.inCart().length;
    if (!confirm(`¿Quitar de la lista ${n === 1 ? 'lo que hay' : `los ${n} artículos que hay`} en el carro?`)) return;
    await this.run(() => this.store.clearDone().then(() => undefined));
  }

  protected async onSave(patch: ShoppingItemPatch) {
    const item = this.editing();
    if (!item) return;
    try {
      await this.store.update(item.id, patch);
      this.editing.set(null);
    } catch (err) {
      this.dialog()?.showError(errorMessage(err, 'No se pudo guardar.'));
    }
  }

  protected async onDelete() {
    const item = this.editing();
    if (!item) return;
    try {
      await this.store.remove(item.id);
      this.editing.set(null);
    } catch (err) {
      this.dialog()?.showError(errorMessage(err, 'No se pudo quitar.'));
    }
  }

  private async run(action: () => Promise<void>) {
    this.status.set('');
    try {
      await action();
    } catch (err) {
      this.status.set(errorMessage(err, 'No se pudo. Revisa la conexión y vuelve a intentarlo.'));
    }
  }
}
