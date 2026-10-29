import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Task, User } from '@hogar/shared';
import { CurrentUser } from '../common/request';
import { HouseholdGuard } from '../households/household.guard';
import { Section, SectionGuard } from '../households/section.guard';
import { TasksService } from './tasks.service';

@Controller('households/:householdId/tasks')
@UseGuards(HouseholdGuard, SectionGuard)
@Section('tareas')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@Param('householdId') householdId: string, @CurrentUser() user: User): Promise<Task[]> {
    return this.tasks.list(householdId, user.id);
  }

  @Post()
  create(@Param('householdId') householdId: string, @CurrentUser() user: User, @Body() body: unknown): Promise<Task> {
    return this.tasks.create(householdId, user.id, body);
  }

  @Patch(':id')
  update(
    @Param('householdId') householdId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: unknown,
  ): Promise<Task> {
    return this.tasks.update(householdId, id, user.id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('householdId') householdId: string, @Param('id') id: string, @CurrentUser() user: User): Promise<void> {
    return this.tasks.remove(householdId, id, user.id);
  }
}
