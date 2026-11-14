import { Body, CanActivate, Controller, Delete, ExecutionContext, Get, HttpCode, Injectable, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { BlockedHousehold, ModerationRecipeInfo } from '@hogar/shared';
import { isModerator } from '../common/moderation';
import { ModerationService } from './moderation.service';

/** Solo para moderadores; a los demás les responde como si no existiera (404). */
@Injectable()
export class ModeratorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: { email?: string } }>().user;
    if (!isModerator(user?.email)) throw new NotFoundException();
    return true;
  }
}

@Controller('moderation')
@UseGuards(ModeratorGuard)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('recipes/:id')
  info(@Param('id') id: string): Promise<ModerationRecipeInfo> {
    return this.moderation.info(id);
  }

  @Post('recipes/:id/unpublish')
  @HttpCode(204)
  unpublish(@Param('id') id: string, @Body() body: unknown): Promise<void> {
    return this.moderation.unpublish(id, body);
  }

  @Post('recipes/:id/remove-photo')
  @HttpCode(204)
  removePhoto(@Param('id') id: string, @Body() body: unknown): Promise<void> {
    return this.moderation.removePhoto(id, body);
  }

  @Post('recipes/:id/delete')
  @HttpCode(204)
  remove(@Param('id') id: string, @Body() body: unknown): Promise<void> {
    return this.moderation.remove(id, body);
  }

  @Get('blocked')
  blocked(): Promise<BlockedHousehold[]> {
    return this.moderation.blocked();
  }

  @Post('households/:householdId/block')
  @HttpCode(204)
  block(@Param('householdId') householdId: string, @Body() body: unknown): Promise<void> {
    return this.moderation.block(householdId, body);
  }

  @Delete('households/:householdId/block')
  @HttpCode(204)
  unblock(@Param('householdId') householdId: string): Promise<void> {
    return this.moderation.unblock(householdId);
  }
}
