import { HttpException, HttpStatus } from '@nestjs/common';

interface Entry {
  count: number;
  resetAt: number;
}

/**
 * Cuenta intentos por clave en una ventana de tiempo. Vive en memoria:
 * se reinicia con el servidor, que para una app de casa es suficiente.
 */
export class RateLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Lanza 429 si la clave ya ha agotado sus intentos. */
  check(key: string): void {
    const entry = this.current(key);
    if (entry && entry.count >= this.max) {
      const minutes = Math.ceil((entry.resetAt - Date.now()) / 60_000);
      throw new HttpException(
        `Demasiados intentos. Vuelve a probar en ${minutes} minuto${minutes === 1 ? '' : 's'}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  hit(key: string): void {
    const entry = this.current(key);
    if (entry) entry.count++;
    else this.entries.set(key, { count: 1, resetAt: Date.now() + this.windowMs });
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  private current(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry && entry.resetAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }
}
