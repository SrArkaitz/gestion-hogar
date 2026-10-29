import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AcceptIdeaResult, Idea, User } from '@hogar/shared';
import { AppRequest, CurrentUser } from '../common/request';
import { HouseholdGuard } from '../households/household.guard';
import { Section, SectionGuard } from '../households/section.guard';
import { IdeasService } from './ideas.service';

@Controller('households/:householdId/ideas')
@UseGuards(HouseholdGuard, SectionGuard)
@Section('ideas')
export class IdeasController {
  constructor(private readonly ideas: IdeasService) {}

  @Get()
  list(@Param('householdId') householdId: string): Promise<Idea[]> {
    return this.ideas.list(householdId);
  }

  @Post()
  create(@Param('householdId') householdId: string, @CurrentUser() user: User, @Body() body: unknown): Promise<Idea> {
    return this.ideas.create(householdId, user.id, body);
  }

  @Patch(':id')
  update(@Param('householdId') householdId: string, @Param('id') id: string, @Body() body: unknown): Promise<Idea> {
    return this.ideas.update(householdId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('householdId') householdId: string, @Param('id') id: string, @Req() req: AppRequest): Promise<void> {
    return this.ideas.remove(householdId, id, { id: req.user!.id, role: req.membership!.role });
  }

  /** Acepta la idea y crea su tarea. */
  /** Aceptar crea una tarea: la casa tiene que usar también Tareas. */
  @Post(':id/accept')
  @Section('tareas')
  accept(
    @Param('householdId') householdId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: unknown,
  ): Promise<AcceptIdeaResult> {
    return this.ideas.accept(householdId, id, user.id, body);
  }
}
