import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Post, Query, Req, Res } from '@nestjs/common';
import { AuthProviders, Me, User } from '@hogar/shared';
import type { Response } from 'express';
import { AppRequest, clientIp, CurrentUser } from '../common/request';
import { safeReturnUrl } from '../common/validation';
import { Public } from './auth.guard';
import { AuthService } from './auth.service';
import { GOOGLE_COOKIE, GoogleLoginError, GoogleMode, GoogleService } from './google.service';
import { SESSION_COOKIE, SessionsService } from './sessions.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    private readonly google: GoogleService,
  ) {}

  /** Formas de entrar disponibles, para mostrar u ocultar el botón de Google. */
  @Public()
  @Get('providers')
  providers(): AuthProviders {
    return { google: this.google.enabled };
  }

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

  /**
   * Lleva a la pantalla de Google. Con ?modo=conectar conecta Google a la cuenta con sesión;
   * si no, entra o crea la cuenta. ?volver=… es la ruta a la que ir al terminar.
   */
  @Public()
  @Get('google')
  googleStart(
    @Query('modo') modo: unknown,
    @Query('volver') volver: unknown,
    @Req() req: AppRequest,
    @Res() res: Response,
  ): void {
    if (!this.google.enabled) throw new NotFoundException('El acceso con Google no está configurado');
    const mode: GoogleMode = modo === 'conectar' ? 'conectar' : 'entrar';
    if (mode === 'conectar' && !req.user) return res.redirect('/entrar');
    res.redirect(this.google.start(mode, safeReturnUrl(volver), res));
  }

  /** Vuelta desde Google. Siempre redirige a una página de la app, con ?error=… si algo falla. */
  @Public()
  @Get('google/callback')
  async googleCallback(@Query() query: Record<string, unknown>, @Req() req: AppRequest, @Res() res: Response) {
    const pending = this.google.takePending(req.cookies?.[GOOGLE_COOKIE], res);
    const mode = pending?.mode ?? 'entrar';
    const errorPage = mode === 'conectar' ? '/casa' : '/entrar';
    try {
      if (!pending) throw new GoogleLoginError('fallo');
      const profile = await this.google.profile(pending, query);
      if (mode === 'conectar') {
        if (!req.user) return res.redirect('/entrar');
        await this.auth.linkGoogle(req.user.id, profile);
      } else {
        const userId = await this.auth.loginWithGoogle(profile);
        await this.sessions.create(userId, res);
      }
      res.redirect(safeReturnUrl(pending.volver));
    } catch (err) {
      const code = err instanceof GoogleLoginError ? err.code : 'fallo';
      res.redirect(`${errorPage}?error=${code}`);
    }
  }

  /** Desconecta Google (solo si la cuenta tiene contraseña). */
  @Delete('google')
  unlinkGoogle(@CurrentUser() user: User): Promise<Me> {
    return this.auth.unlinkGoogle(user.id);
  }
}
