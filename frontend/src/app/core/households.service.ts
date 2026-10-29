import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  CreatedInvitation,
  Household,
  HouseholdSummary,
  Invitation,
  InvitationPreview,
  MemberColor,
  Role,
} from '@hogar/shared';
import { firstValueFrom } from 'rxjs';

/** Llamadas a la API de casas, miembros e invitaciones. */
@Injectable({ providedIn: 'root' })
export class HouseholdsService {
  private readonly http = inject(HttpClient);
  private readonly api = '/api/households';

  create(name: string): Promise<HouseholdSummary> {
    return firstValueFrom(this.http.post<HouseholdSummary>(this.api, { name }));
  }

  get(id: string): Promise<Household> {
    return firstValueFrom(this.http.get<Household>(`${this.api}/${id}`));
  }

  rename(id: string, name: string): Promise<Household> {
    return firstValueFrom(this.http.patch<Household>(`${this.api}/${id}`, { name }));
  }

  setRole(id: string, userId: string, role: Role): Promise<Household> {
    return firstValueFrom(this.http.patch<Household>(`${this.api}/${id}/members/${userId}`, { role }));
  }

  setColor(id: string, userId: string, color: MemberColor): Promise<Household> {
    return firstValueFrom(this.http.patch<Household>(`${this.api}/${id}/members/${userId}/color`, { color }));
  }

  /** Sacar a alguien o salir uno mismo. */
  async removeMember(id: string, userId: string): Promise<{ householdDeleted: boolean }> {
    return firstValueFrom(this.http.delete<{ householdDeleted: boolean }>(`${this.api}/${id}/members/${userId}`));
  }

  invitations(id: string): Promise<Invitation[]> {
    return firstValueFrom(this.http.get<Invitation[]>(`${this.api}/${id}/invitations`));
  }

  createInvitation(id: string): Promise<CreatedInvitation> {
    return firstValueFrom(this.http.post<CreatedInvitation>(`${this.api}/${id}/invitations`, {}));
  }

  async revokeInvitation(id: string, invitationId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/${id}/invitations/${invitationId}`));
  }

  previewInvitation(token: string): Promise<InvitationPreview> {
    return firstValueFrom(this.http.get<InvitationPreview>(`/api/invitations/${encodeURIComponent(token)}`));
  }

  acceptInvitation(token: string): Promise<HouseholdSummary> {
    return firstValueFrom(this.http.post<HouseholdSummary>(`/api/invitations/${encodeURIComponent(token)}/accept`, {}));
  }
}
