import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Put, Res, UseGuards } from '@nestjs/common';
import { Equipment, InventoryItem } from '@hogar/shared';
import type { Response } from 'express';
import { HouseholdGuard } from '../households/household.guard';
import { Section, SectionGuard } from '../households/section.guard';
import { InventoryService } from './inventory.service';

@Controller('households/:householdId/inventory')
@UseGuards(HouseholdGuard, SectionGuard)
@Section('inventario')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('items')
  items(@Param('householdId') householdId: string): Promise<InventoryItem[]> {
    return this.inventory.items(householdId);
  }

  @Post('items')
  createItem(@Param('householdId') householdId: string, @Body() body: unknown): Promise<InventoryItem> {
    return this.inventory.createItem(householdId, body);
  }

  @Patch('items/:id')
  updateItem(@Param('householdId') householdId: string, @Param('id') id: string, @Body() body: unknown): Promise<InventoryItem> {
    return this.inventory.updateItem(householdId, id, body);
  }

  @Delete('items/:id')
  @HttpCode(204)
  removeItem(@Param('householdId') householdId: string, @Param('id') id: string): Promise<void> {
    return this.inventory.removeItem(householdId, id);
  }

  @Get('equipment')
  equipment(@Param('householdId') householdId: string): Promise<Equipment[]> {
    return this.inventory.equipment(householdId);
  }

  @Post('equipment')
  createEquipment(@Param('householdId') householdId: string, @Body() body: unknown): Promise<Equipment> {
    return this.inventory.createEquipment(householdId, body);
  }

  @Patch('equipment/:id')
  updateEquipment(@Param('householdId') householdId: string, @Param('id') id: string, @Body() body: unknown): Promise<Equipment> {
    return this.inventory.updateEquipment(householdId, id, body);
  }

  @Delete('equipment/:id')
  @HttpCode(204)
  removeEquipment(@Param('householdId') householdId: string, @Param('id') id: string): Promise<void> {
    return this.inventory.removeEquipment(householdId, id);
  }

  /** El cuerpo es el archivo tal cual (PDF o imagen); su nombre va en X-File-Name, codificado. */
  @Post('equipment/:id/files')
  addFile(
    @Param('householdId') householdId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('x-file-name') name: unknown,
  ): Promise<Equipment> {
    return this.inventory.addFile(householdId, id, body, name);
  }

  @Get('equipment/:id/files/:fileId')
  async file(
    @Param('householdId') householdId: string,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ): Promise<void> {
    const f = await this.inventory.file(householdId, id, fileId);
    res.setHeader('Content-Type', f.mime);
    // inline: el PDF o la imagen se abre en el navegador; el nombre se conserva al guardarlo.
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(f.path, { headers: { 'Cache-Control': 'private, max-age=3600' } });
  }

  @Delete('equipment/:id/files/:fileId')
  removeFile(@Param('householdId') householdId: string, @Param('id') id: string, @Param('fileId') fileId: string): Promise<Equipment> {
    return this.inventory.removeFile(householdId, id, fileId);
  }
}
