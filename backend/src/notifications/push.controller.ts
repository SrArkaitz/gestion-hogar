import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { PushConfig, User } from '@hogar/shared';
import { CurrentUser } from '../common/request';
import { PushService } from './push.service';

/** Avisos del dispositivo desde el que se llama (cada navegador tiene su suscripción). */
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('config')
  config(): PushConfig {
    return this.push.config();
  }

  @Post('subscriptions')
  @HttpCode(204)
  subscribe(@CurrentUser() user: User, @Body() body: unknown): Promise<void> {
    return this.push.subscribe(user.id, body);
  }

  @Delete('subscriptions')
  @HttpCode(204)
  unsubscribe(@CurrentUser() user: User, @Body() body: unknown): Promise<void> {
    return this.push.unsubscribe(user.id, body);
  }

  /** Manda un aviso de prueba a todos los dispositivos de quien lo pide. */
  @Post('test')
  async test(@CurrentUser() user: User): Promise<{ sent: number }> {
    const sent = await this.push.send([user.id], {
      title: 'Avisos activados',
      body: 'Así te llegarán los recordatorios de la casa.',
      url: '/casa',
      tag: 'prueba',
    });
    return { sent };
  }
}
