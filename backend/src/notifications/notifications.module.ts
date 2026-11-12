import { Global, Module } from '@nestjs/common';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { RemindersService } from './reminders.service';

/** Global para que cualquier módulo pueda mandar avisos con PushService. */
@Global()
@Module({
  controllers: [PushController, InboxController],
  providers: [PushService, InboxService, RemindersService],
  exports: [PushService],
})
export class NotificationsModule {}
