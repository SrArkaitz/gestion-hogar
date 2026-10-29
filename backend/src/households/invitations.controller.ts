import { Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { HouseholdSummary, InvitationPreview, User } from '@hogar/shared';
import { Public } from '../auth/auth.guard';
import { AppRequest, CurrentUser } from '../common/request';
import { InvitationsService } from './invitations.service';

/** Rutas para quien recibe un enlace de invitación. */
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  /** Se puede ver sin sesión, para mostrar a qué casa te invitan antes de registrarte. */
  @Public()
  @Get(':token')
  preview(@Param('token') token: string, @Req() req: AppRequest): Promise<InvitationPreview> {
    return this.invitations.preview(token, req.user?.id);
  }

  @Post(':token/accept')
  @HttpCode(200)
  accept(@Param('token') token: string, @CurrentUser() user: User): Promise<HouseholdSummary> {
    return this.invitations.accept(token, user.id);
  }
}
