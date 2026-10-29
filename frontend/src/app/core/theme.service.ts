import { Injectable, signal } from '@angular/core';

export const THEMES = ['sistema', 'claro', 'oscuro'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = { sistema: 'Sistema', claro: 'Claro', oscuro: 'Oscuro' };

/** Misma clave que lee el script de index.html para aplicar el tema antes de pintar. */
const STORAGE_KEY = 'hogar.tema';

/**
 * Tema claro u oscuro, guardado en este dispositivo. Pone data-theme="light" o "dark" en <html>;
 * con "sistema" sigue al del dispositivo, también si cambia con la app abierta.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media = matchMedia('(prefers-color-scheme: dark)');
  readonly theme = signal<Theme>(read());

  constructor() {
    this.media.addEventListener('change', () => this.apply());
    this.apply();
  }

  set(theme: Theme) {
    this.theme.set(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Sin almacenamiento (modo privado): vale para esta visita.
    }
    this.apply();
  }

  private apply() {
    const theme = this.theme();
    const dark = theme === 'oscuro' || (theme === 'sistema' && this.media.matches);
    document.documentElement.dataset['theme'] = dark ? 'dark' : 'light';
  }
}

function read(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (THEMES as readonly string[]).includes(saved ?? '') ? (saved as Theme) : 'sistema';
  } catch {
    return 'sistema';
  }
}
