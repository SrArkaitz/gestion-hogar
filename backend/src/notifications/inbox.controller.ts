import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
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

  @Post(':id/read')
  @HttpCode(204)
  read(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.inbox.markRead(user.id, id);
  }
}
