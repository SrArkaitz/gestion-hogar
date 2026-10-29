import { Module } from '@nestjs/common';
import { HouseholdGuard } from './household.guard';
import { HouseholdsController } from './households.controller';
import { HouseholdsService } from './households.service';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  controllers: [HouseholdsController, InvitationsController],
  providers: [HouseholdsService, InvitationsService, HouseholdGuard],
  exports: [HouseholdGuard],
})
export class HouseholdsModule {}
