import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module';
import { MenuController, RecipesController } from './recipes.controller';
import { MenuService } from './menu.service';
import { RecipesService } from './recipes.service';

@Module({
  imports: [HouseholdsModule],
  controllers: [RecipesController, MenuController],
  providers: [RecipesService, MenuService],
})
export class RecipesModule {}
