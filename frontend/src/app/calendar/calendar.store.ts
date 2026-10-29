import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Birthday, BirthdayInput, CalendarEvent, CalendarEventInput, CalendarItem, IsoDate } from '@hogar/shared';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../core/session.service';

/** Llamadas a la API del calendario de la casa activa. */
@Injectable({ providedIn: 'root' })
export class CalendarStore {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  private get api() {
    return `/api/households/${this.session.household()?.id}/calendar`;
  }

  items(from: IsoDate, to: IsoDate): Promise<CalendarItem[]> {
    return firstValueFrom(this.http.get<CalendarItem[]>(this.api, { params: { from, to } }));
  }

  event(id: string): Promise<CalendarEvent> {
    return firstValueFrom(this.http.get<CalendarEvent>(`${this.api}/events/${id}`));
  }

  saveEvent(id: string | null, input: CalendarEventInput): Promise<CalendarEvent> {
    return firstValueFrom(
      id ? this.http.patch<CalendarEvent>(`${this.api}/events/${id}`, input) : this.http.post<CalendarEvent>(`${this.api}/events`, input),
    );
  }

  async removeEvent(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/events/${id}`));
  }

  birthdays(): Promise<Birthday[]> {
    return firstValueFrom(this.http.get<Birthday[]>(`${this.api}/birthdays`));
  }

  saveBirthday(id: string | null, input: BirthdayInput): Promise<Birthday> {
    return firstValueFrom(
      id ? this.http.patch<Birthday>(`${this.api}/birthdays/${id}`, input) : this.http.post<Birthday>(`${this.api}/birthdays`, input),
    );
  }

  async removeBirthday(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/birthdays/${id}`));
  }
}
