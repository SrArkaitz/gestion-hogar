import { Injectable } from '@nestjs/common';
import { GoogleError } from '@hogar/shared';
import { createHash } from 'crypto';
import type { Response } from 'express';
import { cookieOptions, newToken } from './sessions.service';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
export const GOOGLE_COOKIE = 'hogar_google';
const COOKIE_PATH = '/api/auth/google';

/** Qué se está haciendo: entrar (o registrarse) o conectar Google a la cuenta con sesión. */
export type GoogleMode = 'entrar' | 'conectar';

/** Datos que se guardan en una cookie mientras el usuario está en la pantalla de Google. */
interface PendingLogin {
  state: string;
  nonce: string;
  verifier: string;
  mode: GoogleMode;
  volver: string;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}

/** Error con el código que se pasa al frontend en ?error=… */
export class GoogleLoginError extends Error {
  constructor(readonly code: GoogleError) {
    super(code);
  }
}

/**
 * Inicio de sesión con Google (OpenID Connect, flujo de código con PKCE).
 * Se activa definiendo GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y PUBLIC_URL.
 */
@Injectable()
export class GoogleService {
  private readonly clientId = process.env.GOOGLE_CLIENT_ID ?? '';
  private readonly clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
  private readonly publicUrl = (process.env.PUBLIC_URL ?? '').replace(/\/+$/, '');

  get enabled(): boolean {
    return !!(this.clientId && this.clientSecret && this.publicUrl);
  }

  private get redirectUri() {
    return `${this.publicUrl}/api/auth/google/callback`;
  }

  /** Guarda state, nonce y verificador PKCE en una cookie y devuelve la URL de Google. */
  start(mode: GoogleMode, volver: string, res: Response): string {
    const pending: PendingLogin = { state: newToken(), nonce: newToken(), verifier: newToken(), mode, volver };
    res.cookie(GOOGLE_COOKIE, JSON.stringify(pending), { ...cookieOptions(), path: COOKIE_PATH, maxAge: 10 * 60_000 });
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: pending.state,
      nonce: pending.nonce,
      code_challenge: createHash('sha256').update(pending.verifier).digest('base64url'),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return `${AUTH_URL}?${params}`;
  }

  /** Lee y borra la cookie del inicio. Devuelve null si falta o no se puede leer. */
  takePending(raw: unknown, res: Response): PendingLogin | null {
    res.clearCookie(GOOGLE_COOKIE, { ...cookieOptions(), path: COOKIE_PATH });
    if (typeof raw !== 'string') return null;
    try {
      const p = JSON.parse(raw) as PendingLogin;
      return typeof p.state === 'string' && typeof p.nonce === 'string' && typeof p.verifier === 'string' ? p : null;
    } catch {
      return null;
    }
  }

  /** Cambia el código por el id_token y comprueba sus datos. */
  async profile(pending: PendingLogin, query: Record<string, unknown>): Promise<GoogleProfile> {
    if (query['error']) throw new GoogleLoginError(query['error'] === 'access_denied' ? 'cancelado' : 'fallo');
    if (typeof query['code'] !== 'string' || query['state'] !== pending.state) throw new GoogleLoginError('fallo');

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: query['code'],
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: pending.verifier,
      }),
    });
    if (!res.ok) throw new GoogleLoginError('fallo');
    const { id_token } = (await res.json()) as { id_token?: string };

    // El id_token llega directamente de Google por HTTPS, así que basta con comprobar
    // sus datos sin verificar la firma (OpenID Connect Core, apartado 3.1.3.7).
    const claims = decodeJwt(id_token);
    const valid =
      claims &&
      ISSUERS.includes(claims['iss'] as string) &&
      claims['aud'] === this.clientId &&
      typeof claims['exp'] === 'number' &&
      claims['exp'] * 1000 > Date.now() &&
      claims['nonce'] === pending.nonce &&
      typeof claims['sub'] === 'string' &&
      typeof claims['email'] === 'string';
    if (!valid) throw new GoogleLoginError('fallo');
    if (claims['email_verified'] !== true) throw new GoogleLoginError('correo-sin-verificar');

    const email = (claims['email'] as string).toLowerCase();
    const name = [claims['name'], claims['given_name'], email.split('@')[0]].find((n) => typeof n === 'string' && n.trim());
    return { sub: claims['sub'] as string, email, name: (name as string).trim().slice(0, 60) };
  }
}

function decodeJwt(token: unknown): Record<string, unknown> | null {
  if (typeof token !== 'string') return null;
  try {
    return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}
