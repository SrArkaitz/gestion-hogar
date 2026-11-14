import { Body, Controller, Delete, Get, Param, Patch, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { BirthdayDate, NotificationKind, User } from '@hogar/shared';
import { CurrentUser } from '../common/request';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Cambia tu nombre ({ "name": "…" }). */
  @Patch('me')
  rename(@CurrentUser() user: User, @Body() body: unknown): Promise<User> {
    return this.users.rename(user.id, body);
  }

  /** La foto llega tal cual en el cuerpo (image/jpeg, image/png o image/webp). */
  @Put('me/avatar')
  setAvatar(@CurrentUser() user: User, @Body() body: unknown): Promise<User> {
    return this.users.setAvatar(user.id, body);
  }

  @Delete('me/avatar')
  removeAvatar(@CurrentUser() user: User): Promise<User> {
    return this.users.removeAvatar(user.id);
  }

  /** Tu cumpleaños ({ "month": 7, "day": 25 }): ese día salen globos en tu foto. */
  @Put('me/birthday')
  setBirthday(@CurrentUser() user: User, @Body() body: unknown): Promise<{ birthday: BirthdayDate | null }> {
    return this.users.setBirthday(user.id, body);
  }

  @Delete('me/birthday')
  removeBirthday(@CurrentUser() user: User): Promise<{ birthday: BirthdayDate | null }> {
    return this.users.setBirthday(user.id, null);
  }

  /** Tipos de aviso desactivados ({ "off": ["comentarios", …] }). */
  @Put('me/notifications')
  setNotifications(@CurrentUser() user: User, @Body() body: unknown): Promise<{ off: NotificationKind[] }> {
    return this.users.setNotifyOff(user.id, body);
  }

  /** La dirección lleva ?v=…, que cambia con cada foto: se puede guardar en caché para siempre. */
  @Get(':id/avatar')
  async avatar(@CurrentUser() user: User, @Param('id') id: string, @Res() res: Response): Promise<void> {
    const path = await this.users.avatarPath(user.id, id);
    res.sendFile(path, { headers: { 'Cache-Control': 'private, max-age=31536000, immutable' } });
  }
}
