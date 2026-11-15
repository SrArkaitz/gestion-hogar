import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ShoppingItem, ShoppingProduct, User } from '@hogar/shared';
import { CurrentUser } from '../common/request';
import { HouseholdGuard } from '../households/household.guard';
import { Section, SectionGuard } from '../households/section.guard';
import { ShoppingService } from './shopping.service';

@Controller('households/:householdId/shopping')
@UseGuards(HouseholdGuard, SectionGuard)
@Section('compra')
export class ShoppingController {
  constructor(private readonly shopping: ShoppingService) {}

  @Get('items')
  list(@Param('householdId') householdId: string): Promise<ShoppingItem[]> {
    return this.shopping.list(householdId);
  }

  @Post('items')
  add(@Param('householdId') householdId: string, @CurrentUser() user: User, @Body() body: unknown): Promise<ShoppingItem> {
    return this.shopping.add(householdId, user.id, body);
  }

  @Post('items/bulk')
  addMany(@Param('householdId') householdId: string, @CurrentUser() user: User, @Body() body: unknown): Promise<ShoppingItem[]> {
    return this.shopping.addMany(householdId, user.id, body);
  }

  @Post('items/clear-done')
  async clearDone(@Param('householdId') householdId: string): Promise<{ removed: number }> {
    return { removed: await this.shopping.clearDone(householdId) };
  }

  @Patch('items/:id')
  update(@Param('householdId') householdId: string, @Param('id') id: string, @Body() body: unknown): Promise<ShoppingItem> {
    return this.shopping.update(householdId, id, body);
  }

  @Delete('items/:id')
  @HttpCode(204)
  remove(@Param('householdId') householdId: string, @Param('id') id: string): Promise<void> {
    return this.shopping.remove(householdId, id);
  }

  /** La foto llega tal cual en el cuerpo (Content-Type image/jpeg, image/png o image/webp). */
  @Put('items/:id/photo')
  setPhoto(@Param('householdId') householdId: string, @Param('id') id: string, @Body() body: unknown): Promise<ShoppingItem> {
    return this.shopping.setPhoto(householdId, id, body);
  }

  @Delete('items/:id/photo')
  removePhoto(@Param('householdId') householdId: string, @Param('id') id: string): Promise<ShoppingItem> {
    return this.shopping.removePhoto(householdId, id);
  }

  /** La dirección lleva ?v=<archivo>, que cambia con cada foto: se puede guardar en caché para siempre. */
  @Get('items/:id/photo')
  async photo(@Param('householdId') householdId: string, @Param('id') id: string, @Res() res: Response): Promise<void> {
    res.sendFile(await this.shopping.photoPath(householdId, id), { headers: { 'Cache-Control': 'private, max-age=31536000, immutable' } });
  }

  @Get('products')
  products(@Param('householdId') householdId: string): Promise<ShoppingProduct[]> {
    return this.shopping.products(householdId);
  }

  @Delete('products/:key')
  @HttpCode(204)
  forgetProduct(@Param('householdId') householdId: string, @Param('key') key: string): Promise<void> {
    return this.shopping.forgetProduct(householdId, key);
  }
}
