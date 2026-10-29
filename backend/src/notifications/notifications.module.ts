import { Global, Module } from '@nestjs/common';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { RemindersService } from './reminders.service';

/** Global para que cualquier módulo pueda mandar avisos con PushService. */
@Global()
@Module({
  controllers: [PushController],
  providers: [PushService, RemindersService],
  exports: [PushService],
})
export class NotificationsModule {}
