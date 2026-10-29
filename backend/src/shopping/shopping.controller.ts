import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ShoppingItem, ShoppingProduct, User } from '@hogar/shared';
import { CurrentUser } from '../common/request';
import { HouseholdGuard } from '../households/household.guard';
import { ShoppingService } from './shopping.service';

@Controller('households/:householdId/shopping')
@UseGuards(HouseholdGuard)
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
