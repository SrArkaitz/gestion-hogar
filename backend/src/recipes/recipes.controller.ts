import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { MenuEntry, MenuSettings, Recipe, RecipeDraft, User } from '@hogar/shared';
import type { Response } from 'express';
import { CurrentUser } from '../common/request';
import { HouseholdGuard } from '../households/household.guard';
import { Section, SectionGuard } from '../households/section.guard';
import { MenuService } from './menu.service';
import { RecipesService } from './recipes.service';

@Controller('households/:householdId/recipes')
@UseGuards(HouseholdGuard, SectionGuard)
@Section('recetas')
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  /** «Mis recetas»: las guardadas de la casa. */
  @Get()
  list(@Param('householdId') householdId: string): Promise<Recipe[]> {
    return this.recipes.list(householdId);
  }

  /** Buscador: ?q=texto&kind=&duration= entre todas las que ve la casa. */
  @Get('search')
  search(@Param('householdId') householdId: string, @Query() query: Record<string, unknown>): Promise<Recipe[]> {
    return this.recipes.search(householdId, query);
  }

  /** Lee una página de recetas ({ url }) y devuelve la receta para revisarla (no guarda nada). */
  @Post('import')
  @HttpCode(200)
  import(@Body() body: unknown): Promise<RecipeDraft> {
    return this.recipes.importFrom(body);
  }

  @Get(':id')
  get(@Param('householdId') householdId: string, @Param('id') id: string): Promise<Recipe> {
    return this.recipes.get(householdId, id);
  }

  @Post()
  create(@Param('householdId') householdId: string, @CurrentUser() user: User, @Body() body: unknown): Promise<Recipe> {
    return this.recipes.create(householdId, user.id, body);
  }

  /** Favorita de la casa: la ven así todos sus miembros. */
  @Put(':id/favorite')
  favorite(@Param('householdId') householdId: string, @CurrentUser() user: User, @Param('id') id: string): Promise<Recipe> {
    return this.recipes.setFavorite(householdId, user.id, id, true);
  }

  @Delete(':id/favorite')
  unfavorite(@Param('householdId') householdId: string, @CurrentUser() user: User, @Param('id') id: string): Promise<Recipe> {
    return this.recipes.setFavorite(householdId, user.id, id, false);
  }

  /** La guarda en «Mis recetas». */
  @Put(':id/saved')
  save(@Param('householdId') householdId: string, @CurrentUser() user: User, @Param('id') id: string): Promise<Recipe> {
    return this.recipes.save(householdId, user.id, id);
  }

  /** La quita de «Mis recetas» (no la borra). */
  @Delete(':id/saved')
  unsave(@Param('householdId') householdId: string, @Param('id') id: string): Promise<Recipe> {
    return this.recipes.unsave(householdId, id);
  }

  @Patch(':id')
  update(@Param('householdId') householdId: string, @Param('id') id: string, @Body() body: unknown): Promise<Recipe> {
    return this.recipes.update(householdId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('householdId') householdId: string, @Param('id') id: string): Promise<void> {
    return this.recipes.remove(householdId, id);
  }

  /** La foto llega tal cual en el cuerpo (Content-Type image/jpeg, image/png o image/webp). */
  @Put(':id/photo')
  setPhoto(@Param('householdId') householdId: string, @Param('id') id: string, @Body() body: unknown): Promise<Recipe> {
    return this.recipes.setPhoto(householdId, id, body);
  }

  @Delete(':id/photo')
  removePhoto(@Param('householdId') householdId: string, @Param('id') id: string): Promise<Recipe> {
    return this.recipes.removePhoto(householdId, id);
  }

  /** La dirección lleva ?v=<archivo>, que cambia con cada foto: se puede guardar en caché para siempre. */
  @Get(':id/photo')
  async photo(@Param('householdId') householdId: string, @Param('id') id: string, @Res() res: Response): Promise<void> {
    const path = await this.recipes.photoPath(householdId, id);
    res.sendFile(path, { headers: { 'Cache-Control': 'private, max-age=31536000, immutable' } });
  }
}

@Controller('households/:householdId/menu')
@UseGuards(HouseholdGuard, SectionGuard)
@Section('recetas')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get()
  list(@Param('householdId') householdId: string, @Query('from') from: unknown, @Query('to') to: unknown): Promise<MenuEntry[]> {
    return this.menu.list(householdId, from, to);
  }

  @Post()
  create(@Param('householdId') householdId: string, @Body() body: unknown): Promise<MenuEntry> {
    return this.menu.create(householdId, body);
  }

  /** Si los platos salen en el calendario (lo cambia cualquiera de la casa). */
  @Get('settings')
  settings(@Param('householdId') householdId: string): Promise<MenuSettings> {
    return this.menu.settings(householdId);
  }

  @Put('settings')
  setSettings(@Param('householdId') householdId: string, @Body() body: unknown): Promise<MenuSettings> {
    return this.menu.setSettings(householdId, body);
  }

  @Patch(':id')
  update(@Param('householdId') householdId: string, @Param('id') id: string, @Body() body: unknown): Promise<MenuEntry> {
    return this.menu.update(householdId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('householdId') householdId: string, @Param('id') id: string): Promise<void> {
    return this.menu.remove(householdId, id);
  }
}
