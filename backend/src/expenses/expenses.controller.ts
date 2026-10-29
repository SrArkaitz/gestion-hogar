import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Balances, Bill, Expense, Settlement, User } from '@hogar/shared';
import { CurrentUser } from '../common/request';
import { HouseholdGuard } from '../households/household.guard';
import { Section, SectionGuard } from '../households/section.guard';
import { BillsService } from './bills.service';
import { ExpensesService } from './expenses.service';

@Controller('households/:householdId')
@UseGuards(HouseholdGuard, SectionGuard)
@Section('gastos')
export class ExpensesController {
  constructor(
    private readonly expenses: ExpensesService,
    private readonly bills: BillsService,
  ) {}

  @Get('expenses')
  list(@Param('householdId') householdId: string, @Query('from') from: unknown, @Query('to') to: unknown): Promise<Expense[]> {
    return this.expenses.list(householdId, from, to);
  }

  @Get('expenses/balances')
  balances(@Param('householdId') householdId: string): Promise<Balances> {
    return this.expenses.balances(householdId);
  }

  @Post('expenses')
  create(@Param('householdId') householdId: string, @CurrentUser() user: User, @Body() body: unknown): Promise<Expense> {
    return this.expenses.create(householdId, user.id, body);
  }

  @Patch('expenses/:id')
  update(@Param('householdId') householdId: string, @Param('id') id: string, @Body() body: unknown): Promise<Expense> {
    return this.expenses.update(householdId, id, body);
  }

  @Delete('expenses/:id')
  @HttpCode(204)
  remove(@Param('householdId') householdId: string, @Param('id') id: string): Promise<void> {
    return this.expenses.remove(householdId, id);
  }

  @Get('settlements')
  settlements(@Param('householdId') householdId: string, @Query('from') from: unknown, @Query('to') to: unknown): Promise<Settlement[]> {
    return this.expenses.listSettlements(householdId, from, to);
  }

  @Post('settlements')
  settle(@Param('householdId') householdId: string, @CurrentUser() user: User, @Body() body: unknown): Promise<Settlement> {
    return this.expenses.settle(householdId, user.id, body);
  }

  @Delete('settlements/:id')
  @HttpCode(204)
  removeSettlement(@Param('householdId') householdId: string, @Param('id') id: string): Promise<void> {
    return this.expenses.removeSettlement(householdId, id);
  }

  @Get('bills')
  listBills(@Param('householdId') householdId: string): Promise<Bill[]> {
    return this.bills.list(householdId);
  }

  @Post('bills')
  createBill(@Param('householdId') householdId: string, @Body() body: unknown): Promise<Bill> {
    return this.bills.create(householdId, body);
  }

  @Patch('bills/:id')
  updateBill(@Param('householdId') householdId: string, @Param('id') id: string, @Body() body: unknown): Promise<Bill> {
    return this.bills.update(householdId, id, body);
  }

  @Delete('bills/:id')
  @HttpCode(204)
  removeBill(@Param('householdId') householdId: string, @Param('id') id: string): Promise<void> {
    return this.bills.remove(householdId, id);
  }

  @Post('bills/:id/pay')
  payBill(
    @Param('householdId') householdId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: unknown,
  ): Promise<{ bill: Bill; expense: Expense }> {
    return this.bills.pay(householdId, user.id, id, body);
  }
}
