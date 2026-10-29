import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  CreatedInvitation,
  Household,
  Invitation,
  INVITATION_DAYS,
  Member,
  MEMBER_COLOR_LABELS,
  MEMBER_COLORS,
  MemberColor,
  NAME_MAX_LENGTH,
  ROLE_LABELS,
} from '@hogar/shared';
import { GoogleButton } from '../auth/google-button';
import { errorMessage, googleErrorMessage } from '../core/errors';
import { HouseholdsService } from '../core/households.service';
import { SessionService } from '../core/session.service';
import { THEME_LABELS, THEMES, ThemeService } from '../core/theme.service';

/** Ajustes de la casa activa: nombre, miembros, invitaciones, otras casas y cuenta. */
@Component({
  selector: 'app-household-page',
  imports: [FormsModule, GoogleButton],
  host: { class: 'view' },
  templateUrl: './household.page.html',
})
export class HouseholdPage {
  protected readonly session = inject(SessionService);
  protected readonly theme = inject(ThemeService);
  protected readonly themes = THEMES;
  protected readonly themeLabels = THEME_LABELS;
  private readonly api = inject(HouseholdsService);
  private readonly router = inject(Router);

  /** Código con el que vuelve la API si falla conectar Google (?error=…). */
  readonly error_ = input<string>(undefined, { alias: 'error' });
  protected readonly googleError = computed(() => googleErrorMessage(this.error_()));

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly nameMax = NAME_MAX_LENGTH;
  protected readonly invitationDays = INVITATION_DAYS;
  protected readonly colors = MEMBER_COLORS;
  protected readonly colorLabels = MEMBER_COLOR_LABELS;
  /** Miembro cuya paleta de colores está abierta. */
  protected readonly pickingColor = signal<string | null>(null);

  protected readonly household = signal<Household | null>(null);
  protected readonly invitations = signal<Invitation[]>([]);
  /** Enlace recién creado. Solo se puede ver ahora, la API no lo vuelve a dar. */
  protected readonly newInvitation = signal<CreatedInvitation | null>(null);
  protected readonly copied = signal(false);
  protected readonly status = signal('');
  protected readonly error = signal('');

  protected readonly newName = signal('');
  protected readonly anotherName = signal('');

  protected readonly me = computed(() => this.session.user()?.id);
  protected readonly isAdmin = this.session.isAdmin;
  private readonly activeId = computed(() => this.session.household()?.id);

  constructor() {
    // Recarga al cambiar de casa en el selector o de rol (no al renombrarla).
    effect(() => {
      const id = this.activeId();
      if (id) this.load(id, this.isAdmin());
    });
  }

  protected inviteLink(token: string): string {
    return `${location.origin}/invitacion/${token}`;
  }

  protected async saveName() {
    await this.run('Nombre guardado.', async (id) => {
      const household = await this.api.rename(id, this.newName());
      this.household.set(household);
      const role = this.session.household()!.role;
      this.session.upsertHousehold({ id, name: household.name, role });
    });
  }

  protected async toggleAdmin(member: Member) {
    const role = member.role === 'admin' ? 'miembro' : 'admin';
    await this.run(`${member.name} ahora es ${ROLE_LABELS[role].toLowerCase()}.`, async (id) => {
      this.household.set(await this.api.setRole(id, member.id, role));
    });
  }

  protected async setColor(member: Member, color: MemberColor) {
    await this.run('', async (id) => {
      this.household.set(await this.api.setColor(id, member.id, color));
      this.pickingColor.set(null);
    });
  }

  protected async removeMember(member: Member) {
    if (!confirm(`¿Sacar a ${member.name} de la casa? Sus tareas asignadas quedarán sin asignar.`)) return;
    await this.run(`${member.name} ya no está en la casa.`, async (id) => {
      await this.api.removeMember(id, member.id);
      this.household.set(await this.api.get(id));
    });
  }

  protected async leave() {
    const household = this.household();
    if (!household) return;
    const alone = household.members.length === 1;
    const question = alone
      ? `Eres el único miembro. Si sales, «${household.name}» se borrará con todo su contenido. ¿Seguro?`
      : `¿Salir de «${household.name}»? Para volver tendrán que invitarte otra vez.`;
    if (!confirm(question)) return;
    await this.run('', async (id) => {
      await this.api.removeMember(id, this.me()!);
      this.session.removeHousehold(id);
      this.router.navigate([this.session.households().length ? '/tareas' : '/bienvenida']);
    });
  }

  protected async createInvitation() {
    await this.run('', async (id) => {
      const inv = await this.api.createInvitation(id);
      this.newInvitation.set(inv);
      this.copied.set(false);
      this.invitations.update((list) => [inv, ...list]);
    });
  }

  protected async copyInvitation() {
    const inv = this.newInvitation();
    if (!inv) return;
    try {
      await navigator.clipboard.writeText(this.inviteLink(inv.token));
      this.copied.set(true);
    } catch {
      this.error.set('No se pudo copiar. Selecciona el enlace y cópialo a mano.');
    }
  }

  protected async revoke(inv: Invitation) {
    await this.run('Invitación anulada.', async (id) => {
      await this.api.revokeInvitation(id, inv.id);
      this.invitations.update((list) => list.filter((i) => i.id !== inv.id));
      if (this.newInvitation()?.id === inv.id) this.newInvitation.set(null);
    });
  }

  protected async createAnother() {
    await this.run('Casa creada. Ya estás en ella.', async () => {
      this.session.upsertHousehold(await this.api.create(this.anotherName()));
      this.anotherName.set('');
    });
  }

  protected async unlinkGoogle() {
    if (!confirm('¿Desconectar Google? Seguirás entrando con tu correo y contraseña.')) return;
    await this.run('Google desconectado.', () => this.session.unlinkGoogle());
  }

  protected async logout() {
    await this.session.logout();
    this.router.navigate(['/entrar']);
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  private async load(id: string, admin: boolean) {
    this.error.set('');
    this.newInvitation.set(null);
    try {
      const household = await this.api.get(id);
      this.household.set(household);
      this.newName.set(household.name);
      this.invitations.set(admin ? await this.api.invitations(id) : []);
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo cargar la casa.'));
    }
  }

  /** Ejecuta una acción sobre la casa activa mostrando el resultado o el error. */
  private async run(success: string, action: (householdId: string) => Promise<void>) {
    const id = this.session.household()?.id;
    if (!id) return;
    this.error.set('');
    this.status.set('');
    try {
      await action(id);
      this.status.set(success);
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo completar. Vuelve a intentarlo.'));
    }
  }
}
