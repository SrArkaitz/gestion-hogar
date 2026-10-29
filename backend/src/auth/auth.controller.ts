import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Me, User } from '@hogar/shared';
import type { Response } from 'express';
import { AppRequest, clientIp, CurrentUser } from '../common/request';
import { Public } from './auth.guard';
import { AuthService } from './auth.service';
import { SESSION_COOKIE, SessionsService } from './sessions.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  /** Crea la cuenta y deja la sesión iniciada. */
  @Public()
  @Post('register')
  async register(@Body() body: unknown, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response): Promise<Me> {
    const userId = await this.auth.register(body, clientIp(req));
    await this.sessions.create(userId, res);
    return this.auth.me(userId);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response): Promise<Me> {
    const userId = await this.auth.login(body, clientIp(req));
    await this.sessions.create(userId, res);
    return this.auth.me(userId);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.sessions.destroy(req.cookies?.[SESSION_COOKIE] as string | undefined, res);
  }

  @Get('me')
  me(@CurrentUser() user: User): Promise<Me> {
    return this.auth.me(user.id);
  }
}
