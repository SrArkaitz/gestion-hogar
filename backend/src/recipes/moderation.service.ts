import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BlockedHousehold, MODERATION_REASON_MAX, ModerationRecipeInfo, recipeNameKey } from '@hogar/shared';
import { asObject, requiredText } from '../common/validation';
import { PushService } from '../notifications/push.service';
import { PrismaService } from '../prisma/prisma.service';
import { recipeName, RecipesService } from './recipes.service';

/**
 * Lo que puede hacer un moderador con las recetas públicas de cualquier casa. Cada acción avisa a
 * todos los de esa casa con el motivo (estos avisos llegan siempre, no se pueden desactivar).
 */
@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly recipes: RecipesService,
  ) {}

  /** De qué casa es una receta pública y si esa casa puede publicar. */
  async info(id: string): Promise<ModerationRecipeInfo> {
    const r = await this.publicRecipe(id);
    return { householdId: r.householdId, householdName: r.household.name, publishBlocked: !!r.household.publishBlockedAt };
  }

  /** La vuelve privada de su casa: no se borra nada. */
  async unpublish(id: string, body: unknown): Promise<void> {
    const reason = this.reason(body);
    const r = await this.publicRecipe(id);
    await this.prisma.recipe.update({ where: { id }, data: { private: true } });
    await this.recipes.detachFromOthers(r);
    await this.notify(r.householdId, {
      title: `Receta quitada de las públicas · ${r.household.name}`,
      body: `«${r.name}» ya no es pública: ${reason}. Sigue en vuestro recetario, solo para vuestra casa.`,
      url: `/recetas/${id}`,
    });
  }

  /** Le cambia el nombre (tiene que seguir siendo único). */
  async rename(id: string, body: unknown): Promise<void> {
    const reason = this.reason(body);
    const name = recipeName(asObject(body)['name']);
    const r = await this.publicRecipe(id);
    if (name === r.name) throw new BadRequestException('Es el mismo nombre');
    await this.recipes.checkName(name, id);
    await this.prisma.recipe.update({ where: { id }, data: { name, nameKey: recipeNameKey(name) } });
    await this.notify(r.householdId, {
      title: `Receta renombrada · ${r.household.name}`,
      body: `«${r.name}» ahora se llama «${name}»: ${reason}.`,
      url: `/recetas/${id}`,
    });
  }

  /** Le quita la foto (la receta sigue siendo pública). */
  async removePhoto(id: string, body: unknown): Promise<void> {
    const reason = this.reason(body);
    const r = await this.publicRecipe(id);
    if (!r.photo) throw new BadRequestException('La receta no tiene foto');
    await this.prisma.recipe.update({ where: { id }, data: { photo: null } });
    this.recipes.deleteFile(r.photo);
    await this.notify(r.householdId, {
      title: `Foto de receta quitada · ${r.household.name}`,
      body: `Se ha quitado la foto de «${r.name}»: ${reason}.`,
      url: `/recetas/${id}`,
    });
  }

  /** La borra del todo (con su foto y sus platos del menú). */
  async remove(id: string, body: unknown): Promise<void> {
    const reason = this.reason(body);
    const r = await this.publicRecipe(id);
    await this.recipes.detachFromOthers(r);
    await this.prisma.recipe.delete({ where: { id } });
    this.recipes.deleteFile(r.photo);
    await this.notify(r.householdId, {
      title: `Receta borrada · ${r.household.name}`,
      body: `Se ha borrado «${r.name}», que era pública: ${reason}.`,
      url: '/recetas',
    });
  }

  /** La casa ya no puede publicar: sus recetas públicas pasan a privadas. */
  async block(householdId: string, body: unknown): Promise<void> {
    const reason = this.reason(body);
    const h = await this.prisma.household.findUnique({ where: { id: householdId } });
    if (!h) throw new NotFoundException('Esa casa no existe');
    const shared = await this.prisma.recipe.findMany({ where: { householdId, private: false }, select: { id: true, householdId: true, name: true } });
    for (const r of shared) await this.recipes.detachFromOthers(r);
    await this.prisma.$transaction([
      this.prisma.household.update({ where: { id: householdId }, data: { publishBlockedAt: h.publishBlockedAt ?? new Date() } }),
      this.prisma.recipe.updateMany({ where: { householdId, private: false }, data: { private: true } }),
    ]);
    await this.notify(householdId, {
      title: `Vuestra casa no puede publicar recetas · ${h.name}`,
      body: `${reason}. Vuestras recetas siguen en vuestro recetario, pero ahora solo las veis vosotros.`,
      url: '/recetas',
    });
  }

  /** Vuelve a poder publicar (sus recetas siguen privadas hasta que las publiquen). */
  async unblock(householdId: string): Promise<void> {
    const h = await this.prisma.household.findUnique({ where: { id: householdId } });
    if (!h) throw new NotFoundException('Esa casa no existe');
    if (!h.publishBlockedAt) return;
    await this.prisma.household.update({ where: { id: householdId }, data: { publishBlockedAt: null } });
    await this.notify(householdId, {
      title: `Ya podéis publicar recetas · ${h.name}`,
      body: 'Vuestras recetas siguen privadas: haced públicas las que queráis desde «Editar».',
      url: '/recetas',
    });
  }

  async blocked(): Promise<BlockedHousehold[]> {
    const rows = await this.prisma.household.findMany({ where: { publishBlockedAt: { not: null } }, orderBy: { publishBlockedAt: 'desc' } });
    return rows.map((h) => ({ id: h.id, name: h.name, blockedAt: h.publishBlockedAt!.toISOString() }));
  }

  /** Solo las públicas: lo privado de cada casa no se modera. */
  private async publicRecipe(id: string) {
    const r = await this.prisma.recipe.findFirst({ where: { id, private: false }, include: { household: true } });
    if (!r) throw new NotFoundException('Esa receta no existe o no es pública');
    return r;
  }

  private reason(body: unknown): string {
    return requiredText(asObject(body)['reason'], 'El motivo', MODERATION_REASON_MAX);
  }

  private async notify(householdId: string, payload: { title: string; body: string; url: string }) {
    const members = await this.prisma.householdMember.findMany({ where: { householdId }, select: { userId: true } });
    // Sin tipo: estos avisos llegan siempre.
    await this.push.send(members.map((m) => m.userId), { ...payload, url: `${payload.url}?casa=${householdId}`, tag: `moderacion-${householdId}` });
  }
}
