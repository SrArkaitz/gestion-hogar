import { Injectable } from '@nestjs/common';
import { User } from '@hogar/shared';
import { createHash, randomBytes } from 'crypto';
import type { CookieOptions, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export const SESSION_COOKIE = 'hogar_sesion';
const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

/**
 * Sesiones guardadas en la base de datos. La cookie lleva un token aleatorio
 * y aquí solo se guarda su hash, así que una copia de la base de datos no
 * sirve para entrar.
 */
@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, res: Response): Promise<void> {
    const token = newToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
    await this.prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await this.prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), expires: expiresAt });
  }

  /**
   * Devuelve el usuario de la sesión o null si no existe o ha caducado.
   * Si queda menos de la mitad del plazo, la alarga y renueva la cookie.
   */
  async validate(token: string, res: Response): Promise<User | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.delete({ where: { id: session.id } });
      return null;
    }
    if (session.expiresAt.getTime() - Date.now() < (SESSION_DAYS / 2) * DAY_MS) {
      const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
      await this.prisma.session.update({ where: { id: session.id }, data: { expiresAt } });
      res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), expires: expiresAt });
    }
    return session.user;
  }

  async destroy(token: string | undefined, res: Response): Promise<void> {
    if (token) await this.prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    res.clearCookie(SESSION_COOKIE, cookieOptions());
  }
}

/**
 * En producción la cookie solo viaja por HTTPS. Para entrar por http://IP:puerto
 * desde casa hay que poner COOKIE_SECURE=false.
 */
function cookieOptions(): CookieOptions {
  const secure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';
  return { httpOnly: true, sameSite: 'lax', secure, path: '/' };
}
