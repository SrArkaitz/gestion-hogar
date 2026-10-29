import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Household,
  HouseholdSummary,
  MEMBER_COLORS,
  MODULES,
  MemberColor,
  NAME_MAX_LENGTH,
  Role,
  ROLES,
} from '@hogar/shared';
import { asObject, oneOf, requiredText } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import { parseHidden } from './section.guard';

@Injectable()
export class HouseholdsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crea una casa con quien la crea como administrador. */
  async create(userId: string, body: unknown): Promise<HouseholdSummary> {
    const name = requiredText(asObject(body)['name'], 'El nombre de la casa', NAME_MAX_LENGTH);
    const household = await this.prisma.household.create({
      data: { name, members: { create: { userId, role: 'admin', color: MEMBER_COLORS[0] } } },
    });
    return { id: household.id, name: household.name, role: 'admin', hiddenModules: [] };
  }

  async get(householdId: string): Promise<Household> {
    const household = await this.prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      include: { members: { include: { user: true }, orderBy: { joinedAt: 'asc' } } },
    });
    return {
      id: household.id,
      name: household.name,
      hiddenModules: parseHidden(household.hiddenModules),
      members: household.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role as Role,
        color: m.color as MemberColor,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }

  /** Cambia el nombre o las secciones que se ocultan (solo administradores). */
  async update(householdId: string, body: unknown): Promise<Household> {
    const b = asObject(body);
    const data: { name?: string; hiddenModules?: string } = {};
    if (b['name'] !== undefined) data.name = requiredText(b['name'], 'El nombre de la casa', NAME_MAX_LENGTH);
    if (b['hiddenModules'] !== undefined) {
      const list = b['hiddenModules'];
      if (!Array.isArray(list) || !list.every((k) => (MODULES as readonly unknown[]).includes(k))) {
        throw new BadRequestException(`hiddenModules tiene que ser una lista de secciones (${MODULES.join(', ')})`);
      }
      data.hiddenModules = MODULES.filter((k) => list.includes(k)).join(',');
    }
    await this.prisma.household.update({ where: { id: householdId }, data });
    return this.get(householdId);
  }

  async setRole(householdId: string, targetId: string, body: unknown): Promise<Household> {
    const role = oneOf(asObject(body)['role'], ROLES, 'Rol');
    const target = await this.findMember(householdId, targetId);
    if (target.role === 'admin' && role !== 'admin') await this.assertNotLastAdmin(householdId);
    await this.prisma.householdMember.update({
      where: { householdId_userId: { householdId, userId: targetId } },
      data: { role },
    });
    return this.get(householdId);
  }

  /** Cambia el color de un miembro. Cada uno elige el suyo; los administradores, el de cualquiera. */
  async setColor(householdId: string, actor: { id: string; role: Role }, targetId: string, body: unknown): Promise<Household> {
    if (actor.id !== targetId && actor.role !== 'admin') {
      throw new ForbiddenException('Solo puedes cambiar tu color');
    }
    const color = oneOf(asObject(body)['color'], MEMBER_COLORS, 'Color');
    await this.findMember(householdId, targetId);
    await this.prisma.householdMember.update({
      where: { householdId_userId: { householdId, userId: targetId } },
      data: { color },
    });
    return this.get(householdId);
  }

  /**
   * Saca a alguien de la casa. Cualquiera puede salir; para sacar a otra persona
   * hay que ser administrador. Si sale el último miembro, la casa se borra.
   * @returns true si la casa se ha borrado.
   */
  async removeMember(householdId: string, actor: { id: string; role: Role }, targetId: string): Promise<boolean> {
    const leaving = actor.id === targetId;
    if (!leaving && actor.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden sacar a alguien de la casa');
    }
    const target = await this.findMember(householdId, targetId);
    const count = await this.prisma.householdMember.count({ where: { householdId } });
    if (count === 1) {
      await this.prisma.household.delete({ where: { id: householdId } });
      return true;
    }
    if (target.role === 'admin') {
      await this.assertNotLastAdmin(
        householdId,
        leaving ? 'Nombra a otro administrador antes de salir de la casa' : undefined,
      );
    }
    await this.prisma.$transaction([
      this.prisma.householdMember.delete({ where: { householdId_userId: { householdId, userId: targetId } } }),
      // Sus tareas personales de esta casa ya no las vería nadie.
      this.prisma.task.deleteMany({ where: { householdId, personal: true, createdById: targetId } }),
      // Deja de estar asignada a las tareas (y recurrentes) de esta casa.
      this.prisma.taskAssignee.deleteMany({ where: { userId: targetId, task: { householdId } } }),
      this.prisma.recurringTaskAssignee.deleteMany({ where: { userId: targetId, recurring: { householdId } } }),
    ]);
    return false;
  }

  private async findMember(householdId: string, userId: string) {
    const member = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId } },
    });
    if (!member) throw new NotFoundException('Esa persona no es miembro de la casa');
    return member;
  }

  private async assertNotLastAdmin(householdId: string, message = 'La casa tiene que tener al menos un administrador') {
    const admins = await this.prisma.householdMember.count({ where: { householdId, role: 'admin' } });
    if (admins <= 1) throw new BadRequestException(message);
  }
}
