import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Equipment, EquipmentInput, InventoryItem, InventoryItemInput } from '@hogar/shared';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../core/session.service';

/** Llamadas a la API del inventario de la casa activa. */
@Injectable({ providedIn: 'root' })
export class InventoryStore {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  private get home() {
    return `/api/households/${this.session.household()?.id}`;
  }

  private get api() {
    return `${this.home}/inventory`;
  }

  items(): Promise<InventoryItem[]> {
    return firstValueFrom(this.http.get<InventoryItem[]>(`${this.api}/items`));
  }

  saveItem(id: string | null, input: Partial<InventoryItemInput>): Promise<InventoryItem> {
    return firstValueFrom(
      id ? this.http.patch<InventoryItem>(`${this.api}/items/${id}`, input) : this.http.post<InventoryItem>(`${this.api}/items`, input),
    );
  }

  async removeItem(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/items/${id}`));
  }

  /** Pasa los nombres a la lista de la compra (sin cantidad: la compra la pone quien compra). */
  async toShopping(names: string[]): Promise<void> {
    await firstValueFrom(this.http.post(`${this.home}/shopping/items/bulk`, { items: names.map((name) => ({ name })) }));
  }

  equipment(): Promise<Equipment[]> {
    return firstValueFrom(this.http.get<Equipment[]>(`${this.api}/equipment`));
  }

  saveEquipment(id: string | null, input: EquipmentInput): Promise<Equipment> {
    return firstValueFrom(
      id ? this.http.patch<Equipment>(`${this.api}/equipment/${id}`, input) : this.http.post<Equipment>(`${this.api}/equipment`, input),
    );
  }

  async removeEquipment(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/equipment/${id}`));
  }

  addFile(id: string, file: File): Promise<Equipment> {
    return firstValueFrom(
      this.http.post<Equipment>(`${this.api}/equipment/${id}/files`, file, {
        headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
      }),
    );
  }

  removeFile(id: string, fileId: string): Promise<Equipment> {
    return firstValueFrom(this.http.delete<Equipment>(`${this.api}/equipment/${id}/files/${fileId}`));
  }

  fileUrl(id: string, fileId: string): string {
    return `${this.api}/equipment/${id}/files/${fileId}`;
  }
}
