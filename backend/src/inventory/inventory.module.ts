import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [HouseholdsModule],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
