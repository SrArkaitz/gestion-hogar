import { Module } from '@nestjs/common';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { DatabaseService } from './database.service';

@Module({
  controllers: [CardsController],
  providers: [DatabaseService, CardsService],
})
export class CardsModule {}
