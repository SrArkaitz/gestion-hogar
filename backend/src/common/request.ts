import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role, User } from '@hogar/shared';
import type { Request } from 'express';

/** Petición con lo que añaden los guards de sesión y de casa. */
export interface AppRequest extends Request {
  user?: User;
  membership?: { householdId: string; role: Role };
}

/**
 * IP de quien hace la petición. Detrás de Cloudflare Tunnel todas llegan desde
 * cloudflared, así que se usa la cabecera que añade Cloudflare.
 */
export function clientIp(req: Request): string {
  const cf = req.headers['cf-connecting-ip'];
  return (typeof cf === 'string' && cf) || req.ip || 'desconocida';
}

/** Usuario con sesión iniciada. Solo en rutas protegidas por AuthGuard. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): User => {
  return ctx.switchToHttp().getRequest<AppRequest>().user!;
});
