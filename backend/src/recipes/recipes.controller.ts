import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { MenuEntry, Recipe, User } from '@hogar/shared';
import type { Response } from 'express';
import { CurrentUser } from '../common/request';
import { HouseholdGuard } from '../households/household.guard';
import { MenuService } from './menu.service';
import { RecipesService } from './recipes.service';

@Controller('households/:householdId/recipes')
@UseGuards(HouseholdGuard)
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  @Get()
  list(@Param('householdId') householdId: string): Promise<Recipe[]> {
    return this.recipes.list(householdId);
  }

  @Get(':id')
  get(@Param('householdId') householdId: string, @Param('id') id: string): Promise<Recipe> {
    return this.recipes.get(householdId, id);
  }

  @Post()
  create(@Param('householdId') householdId: string, @CurrentUser() user: User, @Body() body: unknown): Promise<Recipe> {
    return this.recipes.create(householdId, user.id, body);
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
@UseGuards(HouseholdGuard)
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
