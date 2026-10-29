import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  formatEuros,
  Maintenance,
  MAINTENANCE_GROUPS,
  MAINTENANCE_INTERVAL_MAX,
  MAINTENANCE_NAME_MAX,
  MAINTENANCE_NOTES_MAX,
  MAINTENANCE_NOTICE_MAX,
  MaintenanceDoneInput,
  MaintenanceInput,
  MaintenanceLog,
  parseEuros,
} from '@hogar/shared';
import { firstValueFrom } from 'rxjs';
import { todayIso } from '../core/dates';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';

/** Revisiones periódicas de la casa y el coche, con su historial. */
@Component({
  selector: 'app-maintenance-page',
  imports: [FormsModule],
  host: { class: 'view' },
  templateUrl: './maintenance.page.html',
})
export class MaintenancePage {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  protected readonly max = { name: MAINTENANCE_NAME_MAX, notes: MAINTENANCE_NOTES_MAX, interval: MAINTENANCE_INTERVAL_MAX, notice: MAINTENANCE_NOTICE_MAX };
  protected readonly euros = formatEuros;
  protected readonly today = todayIso();

  protected readonly list = signal<Maintenance[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly status = signal('');
  protected readonly groupOptions = computed(() =>
    [...new Set([...MAINTENANCE_GROUPS, ...this.list().map((m) => m.group).filter((g): g is string => !!g)])].sort((a, b) => a.localeCompare(b, 'es')),
  );

  /** Historial abierto: id de la revisión y sus entradas. */
  protected readonly history = signal<{ id: string; logs: MaintenanceLog[] } | null>(null);

  // Editar: undefined = cerrado, null = nueva.
  protected readonly editing = signal<Maintenance | null | undefined>(undefined);
  protected readonly name = signal('');
  protected readonly group = signal('');
  protected readonly interval = signal<number | null>(12);
  protected readonly nextDue = signal('');
  protected readonly notifyDays = signal<number | null>(7);
  protected readonly notes = signal('');
  protected readonly formError = signal('');

  // Marcar como hecha
  protected readonly doing = signal<Maintenance | null>(null);
  protected readonly doneDate = signal(todayIso());
  protected readonly doneNotes = signal('');
  protected readonly doneCost = signal('');
  protected readonly doneError = signal('');

  private get api() {
    return `/api/households/${this.session.household()?.id}/maintenance`;
  }

  constructor() {
    effect(() => {
      if (this.session.household()?.id) void this.load();
    });
  }

  /** Días hasta la próxima vez (negativo si ya pasó), o null si no tiene fecha. */
  protected daysLeft(m: Maintenance): number | null {
    return m.nextDue ? Math.round((Date.parse(m.nextDue) - Date.parse(this.today)) / 86_400_000) : null;
  }

  protected dueText(m: Maintenance): string {
    const days = this.daysLeft(m);
    if (days === null) return 'Sin próxima fecha';
    if (days === 0) return 'Toca hoy';
    if (days === 1) return 'Toca mañana';
    if (days < 0) return `Vencida hace ${-days} ${days === -1 ? 'día' : 'días'}`;
    return days < 60 ? `Faltan ${days} días · ${this.dateText(m.nextDue!)}` : `El ${this.dateText(m.nextDue!)}`;
  }

  protected state(m: Maintenance): 'late' | 'soon' | 'ok' | 'none' {
    const days = this.daysLeft(m);
    if (days === null) return 'none';
    if (days < 0) return 'late';
    return days <= m.notifyDays ? 'soon' : 'ok';
  }

  protected everyText(m: Maintenance): string {
    if (!m.interval) return 'No se repite';
    if (m.interval === 12) return 'Cada año';
    if (m.interval % 12 === 0) return `Cada ${m.interval / 12} años`;
    return m.interval === 1 ? 'Cada mes' : `Cada ${m.interval} meses`;
  }

  protected dateText(date: string): string {
    const otherYear = date.slice(0, 4) !== this.today.slice(0, 4);
    return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', ...(otherYear && { year: 'numeric' }) });
  }

  protected open(m: Maintenance | null) {
    this.name.set(m?.name ?? '');
    this.group.set(m?.group ?? '');
    this.interval.set(m ? m.interval : 12);
    this.nextDue.set(m?.nextDue ?? '');
    this.notifyDays.set(m?.notifyDays ?? 7);
    this.notes.set(m?.notes ?? '');
    this.formError.set('');
    this.editing.set(m);
  }

  protected async save() {
    const interval = this.interval() || null;
    const notice = this.notifyDays() ?? 0;
    if (!this.name().trim()) return this.formError.set('Escribe qué revisión es.');
    if (interval !== null && (interval < 1 || interval > this.max.interval)) return this.formError.set(`Cada cuántos meses: de 1 a ${this.max.interval}, o vacío si no se repite.`);
    if (notice < 0 || notice > this.max.notice) return this.formError.set(`Aviso: de 0 a ${this.max.notice} días antes.`);
    const input: MaintenanceInput = {
      name: this.name(),
      group: this.group().trim() || null,
      interval,
      nextDue: this.nextDue() || null,
      notifyDays: notice,
      notes: this.notes().trim(),
    };
    const id = this.editing()?.id;
    try {
      const saved = await firstValueFrom(id ? this.http.patch<Maintenance>(`${this.api}/${id}`, input) : this.http.post<Maintenance>(this.api, input));
      this.replace(saved);
      this.editing.set(undefined);
    } catch (err) {
      this.formError.set(errorMessage(err, 'No se pudo guardar.'));
    }
  }

  protected async remove() {
    const m = this.editing();
    if (!m || !confirm(`¿Borrar «${m.name}» y su historial?`)) return;
    try {
      await firstValueFrom(this.http.delete(`${this.api}/${m.id}`));
      this.list.update((list) => list.filter((x) => x.id !== m.id));
      this.editing.set(undefined);
    } catch (err) {
      this.formError.set(errorMessage(err, 'No se pudo borrar.'));
    }
  }

  protected startDone(m: Maintenance) {
    this.doneDate.set(todayIso());
    this.doneNotes.set('');
    this.doneCost.set('');
    this.doneError.set('');
    this.doing.set(m);
  }

  protected async saveDone() {
    const m = this.doing();
    if (!m) return;
    const costText = this.doneCost().trim();
    const cost = costText ? parseEuros(costText) : null;
    if (costText && !cost) return this.doneError.set('Coste no válido. Escríbelo como 45,90 o déjalo vacío.');
    const input: MaintenanceDoneInput = { date: this.doneDate(), notes: this.doneNotes().trim(), cost };
    try {
      const saved = await firstValueFrom(this.http.post<Maintenance>(`${this.api}/${m.id}/done`, input));
      this.replace(saved);
      this.doing.set(null);
      this.status.set(`${m.name}: apuntada.${saved.nextDue ? ` La próxima, el ${this.dateText(saved.nextDue)}.` : ''}`);
      if (this.history()?.id === m.id) await this.loadHistory(m.id);
    } catch (err) {
      this.doneError.set(errorMessage(err, 'No se pudo apuntar.'));
    }
  }

  protected async toggleHistory(m: Maintenance) {
    if (this.history()?.id === m.id) return this.history.set(null);
    await this.loadHistory(m.id);
  }

  protected async removeLog(m: Maintenance, log: MaintenanceLog) {
    if (!confirm(`¿Borrar la entrada del ${this.dateText(log.date)}?`)) return;
    try {
      await firstValueFrom(this.http.delete(`${this.api}/${m.id}/logs/${log.id}`));
      await this.loadHistory(m.id);
      await this.load();
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo borrar.'));
    }
  }

  private async loadHistory(id: string) {
    try {
      this.history.set({ id, logs: await firstValueFrom(this.http.get<MaintenanceLog[]>(`${this.api}/${id}/logs`)) });
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo cargar el historial.'));
    }
  }

  private replace(m: Maintenance) {
    this.list.update((list) =>
      [...list.filter((x) => x.id !== m.id), m].sort(
        (a, b) => (a.nextDue ?? '9999').localeCompare(b.nextDue ?? '9999') || a.name.localeCompare(b.name, 'es'),
      ),
    );
  }

  private async load() {
    try {
      this.list.set(await firstValueFrom(this.http.get<Maintenance[]>(this.api)));
      this.error.set('');
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo cargar el mantenimiento.'));
    } finally {
      this.loading.set(false);
    }
  }
}
