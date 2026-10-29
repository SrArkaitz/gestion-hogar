import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Birthday, CalendarEvent, CalendarItem, User } from '@hogar/shared';
import { CurrentUser } from '../common/request';
import { HouseholdGuard } from '../households/household.guard';
import { Section, SectionGuard } from '../households/section.guard';
import { CalendarService } from './calendar.service';

@Controller('households/:householdId/calendar')
@UseGuards(HouseholdGuard, SectionGuard)
@Section('calendario')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  /** Todo lo que tiene fecha entre dos días (eventos, cumpleaños y lo de las demás secciones). */
  @Get()
  items(@Param('householdId') householdId: string, @Query('from') from: unknown, @Query('to') to: unknown): Promise<CalendarItem[]> {
    return this.calendar.items(householdId, from, to);
  }

  @Get('events/:id')
  getEvent(@Param('householdId') householdId: string, @Param('id') id: string): Promise<CalendarEvent> {
    return this.calendar.getEvent(householdId, id);
  }

  @Post('events')
  createEvent(@Param('householdId') householdId: string, @CurrentUser() user: User, @Body() body: unknown): Promise<CalendarEvent> {
    return this.calendar.createEvent(householdId, user.id, body);
  }

  @Patch('events/:id')
  updateEvent(@Param('householdId') householdId: string, @Param('id') id: string, @Body() body: unknown): Promise<CalendarEvent> {
    return this.calendar.updateEvent(householdId, id, body);
  }

  @Delete('events/:id')
  @HttpCode(204)
  removeEvent(@Param('householdId') householdId: string, @Param('id') id: string): Promise<void> {
    return this.calendar.removeEvent(householdId, id);
  }

  @Get('birthdays')
  birthdays(@Param('householdId') householdId: string): Promise<Birthday[]> {
    return this.calendar.birthdays(householdId);
  }

  @Post('birthdays')
  createBirthday(@Param('householdId') householdId: string, @Body() body: unknown): Promise<Birthday> {
    return this.calendar.createBirthday(householdId, body);
  }

  @Patch('birthdays/:id')
  updateBirthday(@Param('householdId') householdId: string, @Param('id') id: string, @Body() body: unknown): Promise<Birthday> {
    return this.calendar.updateBirthday(householdId, id, body);
  }

  @Delete('birthdays/:id')
  @HttpCode(204)
  removeBirthday(@Param('householdId') householdId: string, @Param('id') id: string): Promise<void> {
    return this.calendar.removeBirthday(householdId, id);
  }
}
