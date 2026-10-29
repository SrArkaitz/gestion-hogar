import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthProviders, HouseholdSummary, LoginInput, Me, RegisterInput } from '@hogar/shared';
import { firstValueFrom } from 'rxjs';
import { PushClientService } from './push.service';

const STORAGE_KEY = 'hogar.casa';

/** Quién ha iniciado sesión, sus casas y cuál está usando ahora. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly push = inject(PushClientService);
  private loaded?: Promise<void>;
  private readonly selectedId = signal<string | null>(readStored());

  readonly me = signal<Me | null>(null);
  readonly user = computed(() => this.me()?.user ?? null);
  readonly households = computed(() => this.me()?.households ?? []);
  /** Casa activa: la elegida si sigue existiendo y, si no, la primera. */
  readonly household = computed<HouseholdSummary | null>(() => {
    const list = this.households();
    return list.find((h) => h.id === this.selectedId()) ?? list[0] ?? null;
  });
  readonly isAdmin = computed(() => this.household()?.role === 'admin');
  /** Formas de entrar que ofrece el servidor (null mientras se consulta). */
  readonly providers = signal<AuthProviders | null>(null);
  private providersLoaded = false;

  /** Carga la sesión una sola vez (la usan los guards de las rutas). */
  ensureLoaded(): Promise<void> {
    return (this.loaded ??= this.refresh());
  }

  async refresh(): Promise<void> {
    try {
      this.me.set(await firstValueFrom(this.http.get<Me>('/api/auth/me')));
    } catch {
      this.me.set(null);
    }
  }

  async login(input: LoginInput): Promise<void> {
    this.setMe(await firstValueFrom(this.http.post<Me>('/api/auth/login', input)));
  }

  async register(input: RegisterInput): Promise<void> {
    this.setMe(await firstValueFrom(this.http.post<Me>('/api/auth/register', input)));
  }

  /** Consulta una vez si el servidor tiene configurado el acceso con Google. */
  async loadProviders(): Promise<void> {
    if (this.providersLoaded) return;
    this.providersLoaded = true;
    try {
      this.providers.set(await firstValueFrom(this.http.get<AuthProviders>('/api/auth/providers')));
    } catch {
      this.providersLoaded = false;
      this.providers.set({ google: false });
    }
  }

  async unlinkGoogle(): Promise<void> {
    this.me.set(await firstValueFrom(this.http.delete<Me>('/api/auth/google')));
  }

  async logout(): Promise<void> {
    try {
      // Que quien entre después en este navegador no reciba los avisos de esta cuenta.
      await this.push.forget().catch(() => undefined);
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
    } finally {
      this.clear();
    }
  }

  /** Olvida la sesión en el navegador (al cerrar sesión o si caduca). */
  clear(): void {
    this.setMe(null);
  }

  select(id: string): void {
    this.selectedId.set(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Sin almacenamiento disponible: se recuerda solo mientras la página siga abierta.
    }
  }

  /** Añade o actualiza una casa en la lista y la deja como activa. */
  upsertHousehold(summary: HouseholdSummary): void {
    this.me.update((me) => {
      if (!me) return me;
      const exists = me.households.some((h) => h.id === summary.id);
      const households = exists
        ? me.households.map((h) => (h.id === summary.id ? summary : h))
        : [...me.households, summary];
      return { ...me, households };
    });
    this.select(summary.id);
  }

  removeHousehold(id: string): void {
    this.me.update((me) => (me ? { ...me, households: me.households.filter((h) => h.id !== id) } : me));
  }

  private setMe(me: Me | null): void {
    this.me.set(me);
    this.loaded = Promise.resolve();
  }
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
