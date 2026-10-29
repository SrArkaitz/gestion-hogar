import { CanActivate, ExecutionContext, Injectable, NotFoundException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULE_LABELS, ModuleKey, MODULES } from '@hogar/shared';
import { AppRequest } from '../common/request';
import { PrismaService } from '../prisma/prisma.service';

const SECTION_KEY = 'section';

/**
 * Secciones que tiene que usar la casa para entrar (ver SectionGuard). Se suman las del
 * controlador y las de la ruta: aceptar una idea pide Ideas y también Tareas.
 */
export const Section = (...keys: ModuleKey[]) => SetMetadata(SECTION_KEY, keys);

/** "tareas,gastos" → ["tareas", "gastos"] (ignorando lo que no sea una sección conocida). */
export function parseHidden(text: string): ModuleKey[] {
  return text.split(',').filter((k): k is ModuleKey => (MODULES as readonly string[]).includes(k));
}

/** Filtro de Prisma para quedarse con las casas que usan una sección. */
export function householdUses(key: ModuleKey) {
  return { NOT: { hiddenModules: { contains: key } } };
}

/**
 * Va después de HouseholdGuard: si la casa tiene oculta la sección del controlador, sus rutas
 * responden como si no existieran. Los datos se conservan por si se vuelve a mostrar.
 */
@Injectable()
export class SectionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const keys = this.reflector.getAllAndMerge<ModuleKey[]>(SECTION_KEY, [context.getHandler(), context.getClass()]);
    if (!keys.length) return true;
    const req = context.switchToHttp().getRequest<AppRequest>();
    const household = await this.prisma.household.findUnique({
      where: { id: req.membership!.householdId },
      select: { hiddenModules: true },
    });
    const hidden = household ? parseHidden(household.hiddenModules) : [...keys];
    const missing = keys.find((k) => hidden.includes(k));
    if (missing) throw new NotFoundException(`Esta casa no usa ${MODULE_LABELS[missing].toLowerCase()}`);
    return true;
  }
}
