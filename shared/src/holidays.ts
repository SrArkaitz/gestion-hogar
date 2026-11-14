import { IsoDate } from './common';
import { addDays } from './recurring';

/** Fiestas que adornan la app unos días antes y el mismo día (o solo ese día). */
export const HOLIDAYS = [
  'anio-nuevo',
  'reyes',
  'marmota',
  'anio-nuevo-chino',
  'san-valentin',
  'carnaval',
  'dia-de-pi',
  'san-patricio',
  'pascua',
  'sant-jordi',
  'star-wars',
  'san-juan',
  'san-fermin',
  'santiago',
  'oktoberfest',
  'halloween',
  'dia-de-muertos',
  'accion-de-gracias',
  'navidad',
  'primavera',
  'verano',
  'otono',
  'invierno',
  'inocentes',
  'dia-del-gato',
  'dia-del-perro',
  'dia-del-chocolate',
  'bisiesto',
  'orgullo-friki',
  'pokemon',
  'mario',
  'viernes-13',
] as const;
export type HolidayKey = (typeof HOLIDAYS)[number];

export interface Holiday {
  key: HolidayKey;
  name: string;
  greeting: string;
}

const INFO: Record<HolidayKey, Omit<Holiday, 'key'>> = {
  'anio-nuevo': { name: 'Año nuevo', greeting: '¡Feliz año nuevo!' },
  reyes: { name: 'Reyes', greeting: '¡Felices Reyes!' },
  marmota: { name: 'Día de la Marmota', greeting: '¡Feliz Día de la Marmota!' },
  'anio-nuevo-chino': { name: 'Año Nuevo Chino', greeting: '¡Feliz Año Nuevo Chino!' },
  'san-valentin': { name: 'San Valentín', greeting: '¡Feliz San Valentín!' },
  carnaval: { name: 'Carnaval', greeting: '¡Feliz Carnaval!' },
  'dia-de-pi': { name: 'Día de Pi', greeting: '¡Feliz Día de Pi! 3,14159…' },
  'san-patricio': { name: 'San Patricio', greeting: '¡Feliz San Patricio!' },
  pascua: { name: 'Pascua', greeting: '¡Feliz Pascua!' },
  'sant-jordi': { name: 'Sant Jordi', greeting: '¡Feliz Sant Jordi!' },
  'star-wars': { name: 'Día de Star Wars', greeting: 'May the 4th be with you' },
  'san-juan': { name: 'Noche de San Juan', greeting: '¡Feliz Noche de San Juan!' },
  'san-fermin': { name: 'San Fermín', greeting: '¡Viva San Fermín!' },
  santiago: { name: 'Santiago Apóstol', greeting: '¡Feliz día de Santiago!' },
  oktoberfest: { name: 'Oktoberfest', greeting: '¡Prost! Es Oktoberfest' },
  halloween: { name: 'Halloween', greeting: '¡Feliz Halloween!' },
  'dia-de-muertos': { name: 'Día de Muertos', greeting: '¡Feliz Día de Muertos!' },
  'accion-de-gracias': { name: 'Acción de Gracias', greeting: '¡Feliz Acción de Gracias!' },
  navidad: { name: 'Navidad', greeting: '¡Feliz Navidad!' },
  primavera: { name: 'Empieza la primavera', greeting: '¡Hola, primavera!' },
  verano: { name: 'Empieza el verano', greeting: '¡Hola, verano!' },
  otono: { name: 'Empieza el otoño', greeting: '¡Hola, otoño!' },
  invierno: { name: 'Empieza el invierno', greeting: '¡Hola, invierno!' },
  inocentes: { name: 'Día de los Inocentes', greeting: '¡Inocente, inocente!' },
  'dia-del-gato': { name: 'Día del Gato', greeting: '¡Feliz Día del Gato! Miau' },
  'dia-del-perro': { name: 'Día del Perro', greeting: '¡Feliz Día del Perro! Guau' },
  'dia-del-chocolate': { name: 'Día del Chocolate', greeting: '¡Feliz Día del Chocolate!' },
  bisiesto: { name: '29 de febrero', greeting: '¡Un día de regalo! Solo llega cada 4 años' },
  'orgullo-friki': { name: 'Día del Orgullo Friki', greeting: '¡Feliz Día del Orgullo Friki! Tira iniciativa' },
  pokemon: { name: 'Día de Pokémon', greeting: '¡Hazte con todos!' },
  mario: { name: 'Día de Mario', greeting: '¡Mamma mia! Hoy es el día MAR10' },
  'viernes-13': { name: 'Viernes 13', greeting: '¡Viernes 13! Cuidado con los gatos negros' },
};

/**
 * Año Nuevo Chino (va por el calendario lunar, no hay una cuenta sencilla): mes y día de cada año.
 * Los años que no están no tienen adorno.
 */
const CHINESE_NEW_YEAR: Record<number, [number, number]> = {
  2024: [2, 10], 2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3],
  2031: [1, 23], 2032: [2, 11], 2033: [1, 31], 2034: [2, 19], 2035: [2, 8], 2036: [1, 28], 2037: [2, 15],
  2038: [2, 4], 2039: [1, 24], 2040: [2, 12],
};
/** Animal de cada año (año % 12), con su artículo. */
const ZODIAC = ['del Mono', 'del Gallo', 'del Perro', 'del Cerdo', 'de la Rata', 'del Buey', 'del Tigre', 'del Conejo', 'del Dragón', 'de la Serpiente', 'del Caballo', 'de la Cabra'];

/** Domingo de Pascua (calendario gregoriano, algoritmo anónimo de Meeus/Jones/Butcher). */
export function easterSunday(year: number): IsoDate {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

/** Cuarto jueves de noviembre (Acción de Gracias). */
export function thanksgiving(year: number): IsoDate {
  const weekday = new Date(Date.UTC(year, 10, 1)).getUTCDay(); // 0 = domingo
  return iso(year, 11, 1 + ((4 - weekday + 7) % 7) + 21);
}

/**
 * Oktoberfest: acaba el primer domingo de octubre (o el 3, si ese domingo cae antes) y empieza
 * el sábado de 15 días antes.
 */
export function oktoberfest(year: number): { from: IsoDate; to: IsoDate } {
  const weekday = new Date(Date.UTC(year, 9, 1)).getUTCDay();
  const sunday = iso(year, 10, 1 + ((7 - weekday) % 7));
  return { from: addDays(sunday, -15), to: sunday < iso(year, 10, 3) ? iso(year, 10, 3) : sunday };
}

/** Términos periódicos de Meeus (cap. 27) para afinar equinoccios y solsticios. */
const SEASON_TERMS = [
  [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186], [182, 27.85, 445267.112],
  [156, 73.14, 45036.886], [136, 171.52, 22518.443], [77, 222.54, 65928.934], [74, 296.72, 3034.906],
  [70, 243.58, 9037.513], [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
  [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417], [18, 155.12, 67555.328],
  [17, 288.79, 4562.452], [16, 198.04, 62894.029], [14, 199.76, 31436.921], [12, 95.39, 14577.848],
  [12, 287.11, 31931.756], [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074],
];
const SEASON_BASE: Record<'primavera' | 'verano' | 'otono' | 'invierno', number[]> = {
  primavera: [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],
  verano: [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.0003],
  otono: [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],
  invierno: [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032],
};

/**
 * Día en que empieza una estación (equinoccio o solsticio del hemisferio norte), en la hora del
 * dispositivo. Algoritmo de Meeus: unos minutos de error, para los años 2000–3000.
 */
export function seasonStart(year: number, season: keyof typeof SEASON_BASE): IsoDate {
  const y = (year - 2000) / 1000;
  const jde0 = SEASON_BASE[season].reduce((sum, c, i) => sum + c * y ** i, 0);
  const t = (jde0 - 2451545) / 36525;
  const rad = Math.PI / 180, w = (35999.373 * t - 2.47) * rad;
  const dl = 1 + 0.0334 * Math.cos(w) + 0.0007 * Math.cos(2 * w);
  const s = SEASON_TERMS.reduce((sum, [a, b, c]) => sum + a * Math.cos((b + c * t) * rad), 0);
  const d = new Date((jde0 + (0.00001 * s) / dl - 2440587.5) * 86400000);
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

interface Season {
  key: HolidayKey;
  /** Primer y último día con adorno (incluidos). */
  from: IsoDate;
  to: IsoDate;
  /** El día de la fiesta (se marca en el calendario). */
  day: IsoDate;
}

const oneDay = (key: HolidayKey, day: IsoDate): Season => ({ key, from: day, to: day, day });

/** Fiestas de un año. */
function seasons(year: number): Season[] {
  const easter = easterSunday(year), turkey = thanksgiving(year), okt = oktoberfest(year);
  const cny = CHINESE_NEW_YEAR[year];
  const list: Season[] = [
    { key: 'anio-nuevo', from: iso(year - 1, 12, 31), to: iso(year, 1, 1), day: iso(year, 1, 1) },
    { key: 'reyes', from: iso(year, 1, 2), to: iso(year, 1, 6), day: iso(year, 1, 6) },
    oneDay('marmota', iso(year, 2, 2)),
    { key: 'san-valentin', from: iso(year, 2, 12), to: iso(year, 2, 14), day: iso(year, 2, 14) },
    // Del jueves lardero al martes de Carnaval
    { key: 'carnaval', from: addDays(easter, -52), to: addDays(easter, -47), day: addDays(easter, -47) },
    oneDay('dia-de-pi', iso(year, 3, 14)),
    { key: 'san-patricio', from: iso(year, 3, 15), to: iso(year, 3, 17), day: iso(year, 3, 17) },
    // Del Domingo de Ramos al Lunes de Pascua
    { key: 'pascua', from: addDays(easter, -7), to: addDays(easter, 1), day: easter },
    { key: 'sant-jordi', from: iso(year, 4, 22), to: iso(year, 4, 23), day: iso(year, 4, 23) },
    oneDay('star-wars', iso(year, 5, 4)),
    // La noche es la del 23
    { key: 'san-juan', from: iso(year, 6, 22), to: iso(year, 6, 24), day: iso(year, 6, 23) },
    // Del chupinazo (6) al «Pobre de mí» (14); el día del santo es el 7
    { key: 'san-fermin', from: iso(year, 7, 6), to: iso(year, 7, 14), day: iso(year, 7, 7) },
    { key: 'santiago', from: iso(year, 7, 24), to: iso(year, 7, 25), day: iso(year, 7, 25) },
    { key: 'oktoberfest', from: okt.from, to: okt.to, day: okt.from },
    { key: 'halloween', from: iso(year, 10, 24), to: iso(year, 10, 31), day: iso(year, 10, 31) },
    { key: 'dia-de-muertos', from: iso(year, 11, 1), to: iso(year, 11, 2), day: iso(year, 11, 2) },
    { key: 'accion-de-gracias', from: addDays(turkey, -1), to: addDays(turkey, 3), day: turkey },
    { key: 'navidad', from: iso(year, 12, 18), to: iso(year, 12, 30), day: iso(year, 12, 25) },
    oneDay('primavera', seasonStart(year, 'primavera')),
    oneDay('verano', seasonStart(year, 'verano')),
    oneDay('otono', seasonStart(year, 'otono')),
    oneDay('invierno', seasonStart(year, 'invierno')),
    oneDay('inocentes', iso(year, 12, 28)),
    oneDay('dia-del-gato', iso(year, 8, 8)),
    oneDay('dia-del-perro', iso(year, 8, 26)),
    oneDay('dia-del-chocolate', iso(year, 9, 13)),
    oneDay('orgullo-friki', iso(year, 5, 25)),
    oneDay('pokemon', iso(year, 2, 27)),
    // MAR10: el 10 de marzo se escribe como «Mario»
    oneDay('mario', iso(year, 3, 10)),
  ];
  if (cny) {
    const day = iso(year, cny[0], cny[1]);
    list.push({ key: 'anio-nuevo-chino', from: addDays(day, -1), to: addDays(day, 2), day });
  }
  // Solo los años bisiestos
  if (new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1) list.push(oneDay('bisiesto', iso(year, 2, 29)));
  // Los viernes que caen en 13 (al final: si coincide con otro día especial, gana el otro)
  for (let m = 1; m <= 12; m++) {
    if (new Date(Date.UTC(year, m - 1, 13)).getUTCDay() === 5) list.push(oneDay('viernes-13', iso(year, m, 13)));
  }
  return list;
}

const span = (s: Season) => Date.parse(s.to) - Date.parse(s.from);

/** Si coinciden varias, gana la más corta (el día de la Marmota frente al Año Nuevo Chino…). */
function find(date: IsoDate, match: (s: Season) => boolean): Holiday | null {
  const year = Number(date.slice(0, 4));
  // El 31 de diciembre ya es la Nochevieja del año siguiente.
  const found = [...seasons(year), ...seasons(year + 1)].filter(match).sort((a, b) => span(a) - span(b))[0];
  if (!found) return null;
  const holiday: Holiday = { key: found.key, ...INFO[found.key] };
  if (found.key === 'anio-nuevo-chino') {
    holiday.greeting = `¡Feliz año ${ZODIAC[Number(found.day.slice(0, 4)) % 12]}!`;
  }
  return holiday;
}

/** Fiesta cuyos días de adorno incluyen esta fecha, o null. */
export function holidayOn(date: IsoDate): Holiday | null {
  return find(date, (s) => s.from <= date && date <= s.to);
}

/** Fiesta que cae justo ese día (Navidad el 25, Halloween el 31…), o null. */
export function holidayDay(date: IsoDate): Holiday | null {
  return find(date, (s) => s.day === date);
}

function iso(year: number, month: number, day: number): IsoDate {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
