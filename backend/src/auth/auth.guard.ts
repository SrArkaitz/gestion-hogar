import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { AppRequest } from '../common/request';
import { SESSION_COOKIE, SessionsService } from './sessions.service';

const IS_PUBLIC = 'isPublic';

/** Ruta accesible sin sesión. Si hay sesión, el usuario se rellena igualmente. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Guard global: todas las rutas piden sesión salvo las marcadas con @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) req.user = (await this.sessions.validate(token, res)) ?? undefined;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (!isPublic && !req.user) throw new UnauthorizedException('Inicia sesión para continuar');
    return true;
  }
}
