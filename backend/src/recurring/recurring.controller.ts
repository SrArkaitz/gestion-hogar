import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RecurringTask, User } from '@hogar/shared';
import { CurrentUser } from '../common/request';
import { HouseholdGuard } from '../households/household.guard';
import { RecurringService } from './recurring.service';

@Controller('households/:householdId/recurring')
@UseGuards(HouseholdGuard)
export class RecurringController {
  constructor(private readonly recurring: RecurringService) {}

  @Get()
  list(@Param('householdId') householdId: string): Promise<RecurringTask[]> {
    return this.recurring.list(householdId);
  }

  @Post()
  create(@Param('householdId') householdId: string, @CurrentUser() user: User, @Body() body: unknown): Promise<RecurringTask> {
    return this.recurring.create(householdId, user.id, body);
  }

  @Patch(':id')
  update(@Param('householdId') householdId: string, @Param('id') id: string, @Body() body: unknown): Promise<RecurringTask> {
    return this.recurring.update(householdId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('householdId') householdId: string, @Param('id') id: string): Promise<void> {
    return this.recurring.remove(householdId, id);
  }
}
