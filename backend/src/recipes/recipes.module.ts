import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module';
import { MenuController, RecipesController } from './recipes.controller';
import { MenuService } from './menu.service';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { RecipesService } from './recipes.service';

@Module({
  imports: [HouseholdsModule],
  controllers: [RecipesController, MenuController, ModerationController],
  providers: [RecipesService, MenuService, ModerationService],
})
export class RecipesModule {}
