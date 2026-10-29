import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
  /** Las del tablero; con ?archived=1, las archivadas (de la más reciente a la más antigua). */
  list(@Param('householdId') householdId: string, @CurrentUser() user: User, @Query('archived') archived?: string): Promise<Task[]> {
    return this.tasks.list(householdId, user.id, archived === '1' || archived === 'true');
  }

  /** Archiva todas las hechas de un tablero ({ "personal": true } para el de tareas personales). */
  @Post('archive-done')
  archiveDone(@Param('householdId') householdId: string, @CurrentUser() user: User, @Body() body: unknown): Promise<{ archived: number }> {
    return this.tasks.archiveDone(householdId, user.id, body);
  }

  @Post(':id/archive')
  archive(@Param('householdId') householdId: string, @Param('id') id: string, @CurrentUser() user: User): Promise<Task> {
    return this.tasks.archive(householdId, id, user.id);
  }

  /** La devuelve al tablero, en Hecho (y vuelve a contar la semana). */
  @Post(':id/unarchive')
  unarchive(@Param('householdId') householdId: string, @Param('id') id: string, @CurrentUser() user: User): Promise<Task> {
    return this.tasks.unarchive(householdId, id, user.id);
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
