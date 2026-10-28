import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CardDialog } from './card-dialog';
import { Card, CardInput, COLUMNS, ColumnId, PRIORITY_ORDER, Priority } from './card.model';
import { CardsService } from './cards.service';

type Filter = 'todas' | Priority;

@Component({
  selector: 'app-root',
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, CardDialog],
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly store = inject(CardsService);
  protected readonly columns = COLUMNS;
  protected readonly filters: { id: Filter; label: string }[] = [
    { id: 'todas', label: 'Todas' },
    { id: 'alta', label: 'Alta' },
    { id: 'media', label: 'Media' },
    { id: 'baja', label: 'Baja' },
  ];

  protected readonly filter = signal<Filter>('todas');
  /** Diálogo abierto: undefined = cerrado, null = tarjeta nueva. */
  protected readonly editing = signal<Card | null | undefined>(undefined);
  protected readonly newColumn = signal<ColumnId>('hacer');

  private readonly dialog = viewChild(CardDialog);
  private justDragged = false;

  /** Tarjetas de cada columna, ordenadas por prioridad y luego por antigüedad. */
  protected readonly byColumn = computed(() => {
    const groups: Record<ColumnId, Card[]> = { casa: [], hacer: [], ideas: [], hecho: [] };
    for (const c of this.store.cards()) groups[c.column]?.push(c);
    for (const list of Object.values(groups)) {
      list.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.createdAt - b.createdAt);
    }
    return groups;
  });

  ngOnInit() {
    this.store.load();
  }

  protected visible(col: ColumnId): Card[] {
    const f = this.filter();
    const list = this.byColumn()[col];
    return f === 'todas' ? list : list.filter((c) => c.priority === f);
  }

  protected dueInfo(card: Card): { text: string; late: boolean } | null {
    if (!card.due) return null;
    const d = new Date(card.due + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      text: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      late: d < today && card.column !== 'hecho',
    };
  }

  protected onDrop(event: CdkDragDrop<ColumnId, ColumnId, string>) {
    this.justDragged = true;
    setTimeout(() => (this.justDragged = false), 50);
    if (event.previousContainer === event.container) return;
    this.store.move(event.item.data, event.container.data);
  }

  protected openCard(card: Card) {
    if (this.justDragged) return;
    this.editing.set(card);
  }

  protected openNew(column: ColumnId) {
    this.newColumn.set(column);
    this.editing.set(null);
  }

  protected close() {
    this.editing.set(undefined);
  }

  protected async onSave(input: CardInput) {
    const card = this.editing();
    try {
      if (card) await this.store.update(card.id, input);
      else await this.store.create(input);
      this.close();
    } catch {
      this.dialog()?.showError('No se pudo guardar. Revisa la conexión y vuelve a intentarlo.');
    }
  }

  protected async onDelete() {
    const card = this.editing();
    if (!card) return;
    try {
      await this.store.remove(card.id);
      this.close();
    } catch {
      this.dialog()?.showError('No se pudo borrar. Vuelve a intentarlo.');
    }
  }
}
