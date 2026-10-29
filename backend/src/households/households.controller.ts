import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { CreatedInvitation, Household, HouseholdSummary, Invitation, User } from '@hogar/shared';
import { AppRequest, CurrentUser } from '../common/request';
import { AdminOnly, HouseholdGuard } from './household.guard';
import { HouseholdsService } from './households.service';
import { InvitationsService } from './invitations.service';

@Controller('households')
export class HouseholdsController {
  constructor(
    private readonly households: HouseholdsService,
    private readonly invitations: InvitationsService,
  ) {}

  @Post()
  create(@CurrentUser() user: User, @Body() body: unknown): Promise<HouseholdSummary> {
    return this.households.create(user.id, body);
  }

  @Get(':householdId')
  @UseGuards(HouseholdGuard)
  get(@Param('householdId') id: string): Promise<Household> {
    return this.households.get(id);
  }

  @Patch(':householdId')
  @UseGuards(HouseholdGuard)
  @AdminOnly()
  update(@Param('householdId') id: string, @Body() body: unknown): Promise<Household> {
    return this.households.update(id, body);
  }

  @Patch(':householdId/members/:userId')
  @UseGuards(HouseholdGuard)
  @AdminOnly()
  setRole(@Param('householdId') id: string, @Param('userId') userId: string, @Body() body: unknown): Promise<Household> {
    return this.households.setRole(id, userId, body);
  }

  @Patch(':householdId/members/:userId/color')
  @UseGuards(HouseholdGuard)
  setColor(
    @Param('householdId') id: string,
    @Param('userId') userId: string,
    @Req() req: AppRequest,
    @Body() body: unknown,
  ): Promise<Household> {
    const actor = { id: req.user!.id, role: req.membership!.role };
    return this.households.setColor(id, actor, userId, body);
  }

  /** Salir de la casa (el propio usuario) o sacar a alguien (administradores). */
  @Delete(':householdId/members/:userId')
  @UseGuards(HouseholdGuard)
  async removeMember(
    @Param('householdId') id: string,
    @Param('userId') userId: string,
    @Req() req: AppRequest,
  ): Promise<{ householdDeleted: boolean }> {
    const actor = { id: req.user!.id, role: req.membership!.role };
    return { householdDeleted: await this.households.removeMember(id, actor, userId) };
  }

  @Get(':householdId/invitations')
  @UseGuards(HouseholdGuard)
  @AdminOnly()
  listInvitations(@Param('householdId') id: string): Promise<Invitation[]> {
    return this.invitations.listPending(id);
  }

  @Post(':householdId/invitations')
  @UseGuards(HouseholdGuard)
  @AdminOnly()
  createInvitation(@Param('householdId') id: string, @CurrentUser() user: User): Promise<CreatedInvitation> {
    return this.invitations.create(id, user.id);
  }

  @Delete(':householdId/invitations/:invitationId')
  @UseGuards(HouseholdGuard)
  @AdminOnly()
  @HttpCode(204)
  revokeInvitation(@Param('householdId') id: string, @Param('invitationId') invitationId: string): Promise<void> {
    return this.invitations.revoke(id, invitationId);
  }
}
