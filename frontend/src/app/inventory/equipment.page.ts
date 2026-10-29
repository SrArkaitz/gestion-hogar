import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Equipment, EQUIPMENT_NAME_MAX, EQUIPMENT_NOTES_MAX, EQUIPMENT_TEXT_MAX, FILE_MAX_BYTES, FILE_TYPES } from '@hogar/shared';
import { todayIso } from '../core/dates';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';
import { InventoryTabs } from './inventory-tabs';
import { InventoryStore } from './inventory.store';

/** Equipos de la casa con su garantía y sus papeles (manuales, facturas…). */
@Component({
  selector: 'app-equipment-page',
  imports: [FormsModule, InventoryTabs],
  host: { class: 'view' },
  templateUrl: './equipment.page.html',
})
export class EquipmentPage {
  protected readonly store = inject(InventoryStore);
  private readonly session = inject(SessionService);

  protected readonly max = { name: EQUIPMENT_NAME_MAX, text: EQUIPMENT_TEXT_MAX, notes: EQUIPMENT_NOTES_MAX };
  protected readonly accept = FILE_TYPES.join(',');
  protected readonly today = todayIso();

  protected readonly list = signal<Equipment[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  /** Equipo al que se está subiendo un archivo. */
  protected readonly uploading = signal<string | null>(null);

  // Diálogo: undefined = cerrado, null = nuevo.
  protected readonly editing = signal<Equipment | null | undefined>(undefined);
  protected readonly name = signal('');
  protected readonly brand = signal('');
  protected readonly model = signal('');
  protected readonly purchaseDate = signal('');
  protected readonly warrantyUntil = signal('');
  protected readonly notes = signal('');
  protected readonly formError = signal('');

  constructor() {
    effect(() => {
      if (this.session.household()?.id) void this.load();
    });
  }

  protected dateText(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** "Garantía hasta el 5 nov 2027 · quedan 3 meses" o "Garantía vencida el …". */
  protected warrantyText(e: Equipment): string {
    if (!e.warrantyUntil) return 'Sin garantía apuntada';
    if (e.warrantyUntil < this.today) return `Garantía vencida el ${this.dateText(e.warrantyUntil)}`;
    const days = Math.round((Date.parse(e.warrantyUntil) - Date.parse(this.today)) / 86_400_000);
    const left = days === 0 ? 'acaba hoy' : days === 1 ? 'acaba mañana' : days < 60 ? `quedan ${days} días` : `quedan ${Math.round(days / 30)} meses`;
    return `Garantía hasta el ${this.dateText(e.warrantyUntil)} · ${left}`;
  }

  protected brandModel(e: Equipment): string {
    return [e.brand, e.model].filter(Boolean).join(' ');
  }

  protected sizeText(bytes: number): string {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  }

  protected open(e: Equipment | null) {
    this.name.set(e?.name ?? '');
    this.brand.set(e?.brand ?? '');
    this.model.set(e?.model ?? '');
    this.purchaseDate.set(e?.purchaseDate ?? '');
    this.warrantyUntil.set(e?.warrantyUntil ?? '');
    this.notes.set(e?.notes ?? '');
    this.formError.set('');
    this.editing.set(e);
  }

  protected async save() {
    if (!this.name().trim()) return this.formError.set('Escribe qué equipo es.');
    try {
      const saved = await this.store.saveEquipment(this.editing()?.id ?? null, {
        name: this.name(),
        brand: this.brand().trim() || null,
        model: this.model().trim() || null,
        purchaseDate: this.purchaseDate() || null,
        warrantyUntil: this.warrantyUntil() || null,
        notes: this.notes().trim(),
      });
      this.replace(saved);
      this.editing.set(undefined);
    } catch (err) {
      this.formError.set(errorMessage(err, 'No se pudo guardar.'));
    }
  }

  protected async remove() {
    const e = this.editing();
    if (!e || !confirm(`¿Borrar «${e.name}» y sus archivos?`)) return;
    try {
      await this.store.removeEquipment(e.id);
      this.list.update((list) => list.filter((x) => x.id !== e.id));
      this.editing.set(undefined);
    } catch (err) {
      this.formError.set(errorMessage(err, 'No se pudo borrar.'));
    }
  }

  protected async attach(e: Equipment, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > FILE_MAX_BYTES) return this.error.set('El archivo es demasiado grande (máximo 20 MB).');
    this.uploading.set(e.id);
    this.error.set('');
    try {
      this.replace(await this.store.addFile(e.id, file));
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo adjuntar el archivo.'));
    } finally {
      this.uploading.set(null);
    }
  }

  protected async removeFile(e: Equipment, fileId: string, name: string) {
    if (!confirm(`¿Quitar «${name}»?`)) return;
    try {
      this.replace(await this.store.removeFile(e.id, fileId));
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo quitar el archivo.'));
    }
  }

  private replace(e: Equipment) {
    this.list.update((list) => [...list.filter((x) => x.id !== e.id), e].sort((a, b) => a.name.localeCompare(b.name, 'es')));
  }

  private async load() {
    try {
      this.list.set(await this.store.equipment());
      this.error.set('');
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudieron cargar los equipos.'));
    } finally {
      this.loading.set(false);
    }
  }
}
