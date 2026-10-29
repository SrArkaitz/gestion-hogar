import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreatedInvitation,
  HouseholdSummary,
  Invitation,
  INVITATION_DAYS,
  InvitationPreview,
  nextMemberColor,
  Role,
} from '@hogar/shared';
import { hashToken, newToken } from '../auth/sessions.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseHidden } from './section.guard';

const INVALID = 'La invitación no existe, ya se ha usado o ha caducado';

@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crea un enlace de un solo uso. El token solo se devuelve ahora; luego no se puede recuperar. */
  async create(householdId: string, createdById: string): Promise<CreatedInvitation> {
    const token = newToken();
    const inv = await this.prisma.invitation.create({
      data: {
        tokenHash: hashToken(token),
        householdId,
        createdById,
        expiresAt: new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000),
      },
      include: { createdBy: true },
    });
    return { ...this.toInvitation(inv), token };
  }

  async listPending(householdId: string): Promise<Invitation[]> {
    const list = await this.prisma.invitation.findMany({
      where: { householdId, usedAt: null, expiresAt: { gt: new Date() } },
      include: { createdBy: true },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((inv) => this.toInvitation(inv));
  }

  async revoke(householdId: string, id: string): Promise<void> {
    const res = await this.prisma.invitation.deleteMany({ where: { id, householdId, usedAt: null } });
    if (res.count === 0) throw new NotFoundException('La invitación no existe');
  }

  async preview(token: string, userId?: string): Promise<InvitationPreview> {
    const inv = await this.findValid(token);
    const alreadyMember = userId
      ? !!(await this.prisma.householdMember.findUnique({
          where: { householdId_userId: { householdId: inv.householdId, userId } },
        }))
      : false;
    return { householdName: inv.household.name, invitedBy: inv.createdBy.name, alreadyMember };
  }

  /** Une al usuario a la casa y gasta la invitación. Si ya era miembro, no la gasta. */
  async accept(token: string, userId: string): Promise<HouseholdSummary> {
    const inv = await this.findValid(token);
    const existing = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId: inv.householdId, userId } },
    });
    const summary = { id: inv.household.id, name: inv.household.name, hiddenModules: parseHidden(inv.household.hiddenModules) };
    if (existing) return { ...summary, role: existing.role as Role };

    await this.prisma.$transaction(async (tx) => {
      // Se marca como usada solo si nadie la ha usado entre medias.
      const used = await tx.invitation.updateMany({ where: { id: inv.id, usedAt: null }, data: { usedAt: new Date() } });
      if (used.count === 0) throw new NotFoundException(INVALID);
      const members = await tx.householdMember.findMany({ where: { householdId: inv.householdId }, select: { color: true } });
      const color = nextMemberColor(members.map((m) => m.color));
      await tx.householdMember.create({ data: { householdId: inv.householdId, userId, role: 'miembro', color } });
    });
    return { ...summary, role: 'miembro' };
  }

  private async findValid(token: string) {
    const inv = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { household: true, createdBy: true },
    });
    if (!inv || inv.usedAt || inv.expiresAt.getTime() <= Date.now()) throw new NotFoundException(INVALID);
    return inv;
  }

  private toInvitation(inv: { id: string; createdAt: Date; expiresAt: Date; createdBy: { name: string } }): Invitation {
    return {
      id: inv.id,
      createdBy: inv.createdBy.name,
      createdAt: inv.createdAt.toISOString(),
      expiresAt: inv.expiresAt.toISOString(),
    };
  }
}
