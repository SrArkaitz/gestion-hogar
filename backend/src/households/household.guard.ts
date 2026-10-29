import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@hogar/shared';
import { AppRequest } from '../common/request';
import { PrismaService } from '../prisma/prisma.service';

const ADMIN_ONLY = 'adminOnly';

/** Solo pueden usarla los administradores de la casa. */
export const AdminOnly = () => SetMetadata(ADMIN_ONLY, true);

/**
 * Para rutas con :householdId. Comprueba que el usuario es miembro de esa casa
 * y deja su rol en req.membership. Todos los módulos de la app (tareas, ideas…)
 * cuelgan de /households/:householdId y usan este guard.
 */
@Injectable()
export class HouseholdGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const householdId = req.params['householdId'];
    const member = typeof householdId === 'string'
      ? await this.prisma.householdMember.findUnique({
          where: { householdId_userId: { householdId, userId: req.user!.id } },
        })
      : null;
    // 404 y no 403: quien no es miembro no tiene por qué saber que la casa existe.
    if (!member) throw new NotFoundException('La casa no existe');
    req.membership = { householdId: member.householdId, role: member.role as Role };

    const adminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY, [ctx.getHandler(), ctx.getClass()]);
    if (adminOnly && member.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores de la casa pueden hacer esto');
    }
    return true;
  }
}
