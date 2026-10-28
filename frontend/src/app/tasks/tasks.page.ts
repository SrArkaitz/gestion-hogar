import { Component } from '@angular/core';
import { TASK_STATUSES, TASK_STATUS_LABELS } from '@hogar/shared';

/** Tablero de tareas. De momento solo muestra las columnas vacías. */
@Component({
  selector: 'app-tasks-page',
  host: { class: 'view' },
  template: `
    <header class="top">
      <div>
        <h1>Tareas</h1>
        <p class="sub">Lo que hay que hacer en casa, por prioridad.</p>
      </div>
    </header>

    <div class="board">
      @for (status of statuses; track status) {
        <section class="col">
          <div class="col-h">
            <h2>{{ labels[status] }}</h2>
            <span class="count">0</span>
          </div>
          <p class="empty">Sin tareas todavía.</p>
        </section>
      }
    </div>
  `,
})
export class TasksPage {
  protected readonly statuses = TASK_STATUSES;
  protected readonly labels = TASK_STATUS_LABELS;
}
