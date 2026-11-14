import { Injectable, computed, signal } from '@angular/core';
import { BirthdayDate, holidayDay, holidayOn, IsoDate, isBirthdayOn } from '@hogar/shared';
import { todayIso } from './dates';

/** Clave en este navegador: "no" si se han quitado los adornos. */
const STORAGE_KEY = 'hogar.adornos';

/**
 * Adornos de fiestas (calabaza en Halloween, árbol en Navidad…). Se pueden quitar en cada
 * dispositivo. La fecha se vuelve a mirar al volver a la app, por si se quedó abierta de un día
 * para otro.
 */
@Injectable({ providedIn: 'root' })
export class FestiveService {
  readonly enabled = signal(read());
  /** Hoy (se vuelve a mirar al volver a la app). */
  readonly today = signal(todayIso());

  /** Fiesta de hoy (o de estos días), si los adornos están puestos. */
  readonly holiday = computed(() => (this.enabled() ? holidayOn(this.today()) : null));

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.today.set(todayIso());
    });
  }

  /** Si hoy es su cumpleaños (los globos salen aunque se hayan quitado los adornos de fiestas). */
  isBirthday(b: BirthdayDate | null | undefined): boolean {
    return isBirthdayOn(b, this.today());
  }

  /** Fiesta que cae justo ese día, para marcarla en el calendario. */
  dayOf(date: IsoDate) {
    return this.enabled() ? holidayDay(date) : null;
  }

  setEnabled(on: boolean) {
    this.enabled.set(on);
    try {
      if (on) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, 'no');
    } catch {
      // Sin almacenamiento: vale para esta visita.
    }
  }
}

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'no';
  } catch {
    return true;
  }
}
