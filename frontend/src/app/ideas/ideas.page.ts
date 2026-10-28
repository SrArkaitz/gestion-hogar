import { Component } from '@angular/core';
import { IDEA_STATUSES, IDEA_STATUS_LABELS } from '@hogar/shared';

/** Ideas de la casa. De momento solo muestra los estados vacíos. */
@Component({
  selector: 'app-ideas-page',
  host: { class: 'view' },
  template: `
    <header class="top">
      <div>
        <h1>Ideas</h1>
        <p class="sub">Apuntadlas, valoradlas y convertid las buenas en tareas.</p>
      </div>
    </header>

    <div class="seg" role="group" aria-label="Filtrar por estado">
      @for (status of statuses; track status; let first = $first) {
        <button type="button" [attr.aria-pressed]="first">{{ labels[status] }}</button>
      }
    </div>

    <p class="empty">Sin ideas todavía.</p>
  `,
})
export class IdeasPage {
  protected readonly statuses = IDEA_STATUSES;
  protected readonly labels = IDEA_STATUS_LABELS;
}
