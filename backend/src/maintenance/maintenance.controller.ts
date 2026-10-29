import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Maintenance, MaintenanceLog, User } from '@hogar/shared';
import { CurrentUser } from '../common/request';
import { HouseholdGuard } from '../households/household.guard';
import { Section, SectionGuard } from '../households/section.guard';
import { MaintenanceService } from './maintenance.service';

@Controller('households/:householdId/maintenance')
@UseGuards(HouseholdGuard, SectionGuard)
@Section('mantenimiento')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  list(@Param('householdId') householdId: string): Promise<Maintenance[]> {
    return this.maintenance.list(householdId);
  }

  @Post()
  create(@Param('householdId') householdId: string, @Body() body: unknown): Promise<Maintenance> {
    return this.maintenance.create(householdId, body);
  }

  @Patch(':id')
  update(@Param('householdId') householdId: string, @Param('id') id: string, @Body() body: unknown): Promise<Maintenance> {
    return this.maintenance.update(householdId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('householdId') householdId: string, @Param('id') id: string): Promise<void> {
    return this.maintenance.remove(householdId, id);
  }

  /** Apunta que se ha hecho (fecha, notas y coste) y pasa a la próxima fecha. */
  @Post(':id/done')
  done(@Param('householdId') householdId: string, @Param('id') id: string, @CurrentUser() user: User, @Body() body: unknown): Promise<Maintenance> {
    return this.maintenance.done(householdId, user.id, id, body);
  }

  @Get(':id/logs')
  logs(@Param('householdId') householdId: string, @Param('id') id: string): Promise<MaintenanceLog[]> {
    return this.maintenance.logs(householdId, id);
  }

  @Delete(':id/logs/:logId')
  @HttpCode(204)
  removeLog(@Param('householdId') householdId: string, @Param('id') id: string, @Param('logId') logId: string): Promise<void> {
    return this.maintenance.removeLog(householdId, id, logId);
  }
}
