import { Component, inject } from '@angular/core';
import { SessionService } from '../core/session.service';

/** Nombre de la casa activa. Si la persona está en varias, permite cambiar. */
@Component({
  selector: 'app-household-switcher',
  host: { class: 'switcher' },
  template: `
    @if (session.households().length > 1) {
      <label>
        <span class="sr-only">Casa</span>
        <select [value]="session.household()?.id" (change)="onChange($event)">
          @for (h of session.households(); track h.id) {
            <option [value]="h.id" [selected]="h.id === session.household()?.id">{{ h.name }}</option>
          }
        </select>
      </label>
    } @else {
      <span class="name">{{ session.household()?.name }}</span>
    }
  `,
})
export class HouseholdSwitcher {
  protected readonly session = inject(SessionService);

  protected onChange(event: Event) {
    this.session.select((event.target as HTMLSelectElement).value);
  }
}
