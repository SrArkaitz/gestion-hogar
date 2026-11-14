import { Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { NotificationList, User } from '@hogar/shared';
import { CurrentUser } from '../common/request';
import { InboxService } from './inbox.service';

/** Avisos de la campanita de quien llama (son de la persona, de todas sus casas). */
@Controller('notifications')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<NotificationList> {
    return this.inbox.list(user.id);
  }

  @Post('read-all')
  @HttpCode(204)
  readAll(@CurrentUser() user: User): Promise<void> {
    return this.inbox.markAllRead(user.id);
  }

  /** Quita los ya leídos (va antes que :id para que "read" no se tome por un id). */
  @Delete('read')
  async removeRead(@CurrentUser() user: User): Promise<{ removed: number }> {
    return { removed: await this.inbox.removeRead(user.id) };
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.inbox.remove(user.id, id);
  }

  @Post(':id/read')
  @HttpCode(204)
  read(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.inbox.markRead(user.id, id);
  }
}
