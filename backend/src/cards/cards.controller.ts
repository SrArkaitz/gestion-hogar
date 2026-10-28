import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CardsService } from './cards.service';

@Controller('cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  findAll() {
    return this.cards.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cards.findOne(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.cards.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.cards.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    this.cards.remove(id);
  }
}
