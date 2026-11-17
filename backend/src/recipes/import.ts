import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import {
  Ingredient,
  INGREDIENT_NAME_MAX,
  INGREDIENT_TEXT_MAX,
  INGREDIENTS_MAX,
  productKey,
  RECIPE_MINUTES_MAX,
  RECIPE_NAME_MAX,
  RECIPE_SERVINGS_MAX,
  RECIPE_SOURCE_MAX,
  RecipeDraft,
  RecipeDuration,
  RecipeKind,
  STEP_MAX,
  STEPS_MAX,
  tidyName,
  Unit,
} from '@hogar/shared';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

/**
 * Importar una receta desde su página. Casi todas las webs de recetas publican la receta en
 * JSON-LD (schema.org/Recipe) para los buscadores: de ahí se sacan nombre, raciones, tiempo,
 * ingredientes, pasos y foto. No se guarda nada: se devuelve para revisarlo en el formulario.
 */

const PAGE_MAX_BYTES = 3 * 1024 * 1024;
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 4;
const HEADERS = {
  // Algunas webs no responden a lo que no parece un navegador.
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9',
};

export async function importRecipe(address: string): Promise<RecipeDraft> {
  const page = await download(pageUrl(address), 'text/html,application/xhtml+xml', PAGE_MAX_BYTES);
  const html = page.body.toString('utf8');
  const recipe = findRecipe(html);
  if (!recipe) {
    throw new UnprocessableEntityException('No encuentro una receta en esa página. Prueba con otra web o apúntala a mano.');
  }
  const name = text(recipe['name']).slice(0, RECIPE_NAME_MAX) || metaContent(html, 'og:title').slice(0, RECIPE_NAME_MAX);
  if (!name) throw new UnprocessableEntityException('La receta de esa página no tiene nombre.');
  const minutes = totalMinutes(recipe);
  const imageUrl = firstImage(recipe['image']) ?? (metaContent(html, 'og:image') || null);
  return {
    name,
    kind: guessKind(recipe, name),
    duration: durationOf(minutes),
    minutes,
    servings: servingsOf(recipe['recipeYield']),
    ingredients: list(recipe['recipeIngredient'] ?? recipe['ingredients'])
      .map((i) => parseIngredient(text(i)))
      .filter((i): i is Ingredient => !!i)
      .slice(0, INGREDIENTS_MAX),
    steps: instructions(recipe['recipeInstructions']).slice(0, STEPS_MAX),
    notes: '',
    source: page.url.slice(0, RECIPE_SOURCE_MAX),
    photo: imageUrl ? await photoData(imageUrl, page.url) : null,
  };
}

// --- Descarga, sin dejar que se use para entrar en la red de la casa ---

function pageUrl(address: string): string {
  const withScheme = /^https?:\/\//i.test(address) ? address : `https://${address}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new BadRequestException('Esa dirección no es válida');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new BadRequestException('Esa dirección no es válida');
  return url.toString();
}

/** Direcciones de la propia máquina o de la red local: el servidor no las abre. */
function privateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return v.includes('.') ? privateAddress(v.slice(7)) : true;
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') ||
    v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb');
}

async function assertPublic(url: URL) {
  // Solo para las pruebas automáticas, que sirven las páginas desde la propia máquina.
  if (process.env['RECIPE_IMPORT_ALLOW_LOCAL'] === '1') return;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (!addresses.length) throw new BadRequestException('No se encuentra esa web. Revisa la dirección.');
  if (addresses.some(privateAddress)) throw new BadRequestException('Solo se pueden importar recetas de webs públicas');
}

async function download(address: string, accept: string, maxBytes: number): Promise<{ url: string; type: string; body: Buffer }> {
  let url = new URL(address);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new BadRequestException('Esa dirección no es válida');
    await assertPublic(url);
    let res: Response;
    try {
      res = await fetch(url, { redirect: 'manual', headers: { ...HEADERS, Accept: accept }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new BadRequestException('No se pudo abrir esa página. Revisa la dirección o prueba más tarde.');
    }
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) throw new BadRequestException(`Esa página no se pudo abrir (error ${res.status}).`);
    return { url: url.toString(), type: res.headers.get('content-type') ?? '', body: await readLimited(res, maxBytes) };
  }
  throw new BadRequestException('Esa página redirige demasiadas veces.');
}

async function readLimited(res: Response, maxBytes: number): Promise<Buffer> {
  if (!res.body) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let size = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new BadRequestException('Esa página es demasiado grande.');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

/** La foto como data URL; si no se puede bajar, la receta se importa sin foto. */
async function photoData(address: string, base: string): Promise<string | null> {
  try {
    const img = await download(new URL(address, base).toString(), 'image/*', IMAGE_MAX_BYTES);
    const type = img.type.split(';')[0].trim();
    if (!type.startsWith('image/') || !img.body.length) return null;
    return `data:${type};base64,${img.body.toString('base64')}`;
  } catch {
    return null;
  }
}

// --- Lectura de la página ---

type Json = Record<string, unknown>;

/** El primer objeto schema.org Recipe de los bloques JSON-LD (también dentro de @graph). */
export function findRecipe(html: string): Json | null {
  const blocks = html.matchAll(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, raw] of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(raw.trim().replace(/^<!--|-->$/g, ''));
    } catch {
      continue;
    }
    const found = search(data, 0);
    if (found) return found;
  }
  return null;
}

function search(node: unknown, depth: number): Json | null {
  if (depth > 6 || !node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = search(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Json;
  const type = obj['@type'];
  if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) return obj;
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    const found = search(obj[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function metaContent(html: string, property: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*>`, 'i');
  const tag = re.exec(html)?.[0];
  return tag ? text(/content=["']([^"']*)["']/i.exec(tag)?.[1] ?? '') : '';
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó',
  uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü',
  Uuml: 'Ü', iexcl: '¡', iquest: '¿', ordm: 'º', ordf: 'ª', deg: '°', frac12: '½', frac14: '¼', frac34: '¾',
  middot: '·', hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

/** Texto limpio: sin etiquetas HTML, con las entidades traducidas y sin espacios de más. */
function text(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return decode(decode(String(value)).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
}

function firstImage(value: unknown): string | null {
  for (const item of list(value)) {
    if (typeof item === 'string' && item.trim()) return item.trim();
    if (item && typeof item === 'object') {
      const url = (item as Json)['url'] ?? (item as Json)['contentUrl'];
      if (typeof url === 'string' && url.trim()) return url.trim();
    }
  }
  return null;
}

/** "PT1H30M" → 90. */
function isoMinutes(value: unknown): number {
  const m = typeof value === 'string' ? /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/i.exec(value.trim()) : null;
  return m ? Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}

function totalMinutes(r: Json): number | null {
  const total = isoMinutes(r['totalTime']) || isoMinutes(r['prepTime']) + isoMinutes(r['cookTime']);
  return total > 0 ? Math.min(total, RECIPE_MINUTES_MAX) : null;
}

function durationOf(minutes: number | null): RecipeDuration {
  if (minutes === null) return 'medio';
  return minutes <= 30 ? 'rapido' : minutes <= 60 ? 'medio' : 'largo';
}

function servingsOf(value: unknown): number {
  for (const item of list(value)) {
    const n = typeof item === 'number' ? item : Number(/\d+/.exec(text(item))?.[0]);
    if (Number.isFinite(n) && n >= 1) return Math.min(Math.round(n), RECIPE_SERVINGS_MAX);
  }
  return 4;
}

/** Por la categoría y el nombre; si no se sabe, plato único (se cambia en el formulario). */
function guessKind(r: Json, name: string): RecipeKind {
  const hay = productKey([...list(r['recipeCategory']), ...list(r['keywords']), name].map(text).join(' '));
  if (/postre|dulce|tarta|bizcocho|galleta|helado|flan|natillas|reposteria|pastel|magdalena/.test(hay)) return 'postre';
  if (/entrante|primer plato|primeros|ensalada|sopa|crema de|aperitivo|gazpacho|salmorejo/.test(hay)) return 'primero';
  if (/segundo|plato principal|principales/.test(hay)) return 'segundo';
  return 'unico';
}

/** Pasos de recipeInstructions: texto, lista, HowToStep o HowToSection. */
function instructions(value: unknown): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    const step = s.replace(/^\s*(?:paso\s*)?\d+\s*[.)-]\s*/i, '').trim();
    if (step) out.push(step.slice(0, STEP_MAX));
  };
  const walk = (node: unknown) => {
    if (typeof node === 'string') {
      // Un texto con párrafos o líneas: un paso por cada uno.
      const lines = decode(node).replace(/<\/(p|li|div)>|<br\s*\/?>/gi, '\n').split(/\n+/);
      for (const line of lines) add(text(line));
    } else if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (node && typeof node === 'object') {
      const o = node as Json;
      if (o['itemListElement']) walk(o['itemListElement']);
      else add(text(o['text'] ?? o['name']));
    }
  };
  walk(value);
  return out;
}

// --- Ingredientes: "200 g de arroz", "1 cucharada de aceite", "Sal al gusto" ---

const FRACTIONS: Record<string, string> = { '½': ' 1/2', '¼': ' 1/4', '¾': ' 3/4', '⅓': ' 1/3', '⅔': ' 2/3', '⅛': ' 1/8' };
const QTY_RE = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)(?:\s*(?:-|a)\s*\d+(?:[.,]\d+)?)?\s*/;
/** Unidades que entiende la app (con lo que hay que multiplicar). */
const UNIT_RE = /^(kilogramos?|kilos?|kg|gramos?|grs?|g|mililitros?|ml|centilitros?|cl|decilitros?|dl|litros?|l|unidades?|uds?)\.?(?![\p{L}])\s*(?:de\s+)?/iu;
/** Medidas de cocina que no se suman en la compra: van como texto ("1 cucharada"). */
const MEASURE_RE = /^(cucharadas?(?: soperas?| de postre)?|cucharaditas?|cdas?|cditas?|tazas?|vasos?|pizcas?|chorr(?:it)?os?|puñados?|copas?|manojos?|ramitas?)\.?(?![\p{L}])\s*(?:de\s+)?/iu;

function number(qty: string): number {
  const parts = qty.trim().split(/\s+/);
  return parts.reduce((sum, p) => {
    const [a, b] = p.split('/');
    return sum + (b ? Number(a) / Number(b) : Number(p.replace(',', '.')));
  }, 0);
}

function unitOf(word: string): { unit: Unit; factor: number } {
  const w = word.toLowerCase();
  if (w.startsWith('k')) return { unit: 'kg', factor: 1 };
  if (w.startsWith('g')) return { unit: 'g', factor: 1 };
  if (w === 'ml' || w.startsWith('mili')) return { unit: 'ml', factor: 1 };
  if (w === 'cl' || w.startsWith('centi')) return { unit: 'ml', factor: 10 };
  if (w === 'dl' || w.startsWith('deci')) return { unit: 'ml', factor: 100 };
  if (w.startsWith('u')) return { unit: 'ud', factor: 1 };
  return { unit: 'l', factor: 1 };
}

/** Nombre del ingrediente, sin signos sueltos y con mayúscula inicial ("lentejas" → "Lentejas"). */
const cleanName = (s: string) => {
  const name = s.replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '').slice(0, INGREDIENT_NAME_MAX).trim();
  return name ? tidyName(name) : '';
};

export function parseIngredient(raw: string): Ingredient | null {
  let s = raw.replace(/[½¼¾⅓⅔⅛]/g, (c) => FRACTIONS[c]).replace(/^[-•*]\s*/, '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  // "Sal al gusto", "Aceite c/s"
  const toTaste = /\s*[,(]?\s*(al gusto|a gusto|c\/s|cantidad necesaria)\)?\s*$/i.exec(s);
  if (toTaste) s = s.slice(0, toTaste.index);
  const q = QTY_RE.exec(s);
  if (!q) {
    const name = cleanName(s);
    return name ? { name, amount: null, unit: null, text: toTaste ? 'al gusto' : null } : null;
  }
  const qty = q[1];
  const amount = number(qty);
  let rest = s.slice(q[0].length);
  const measure = MEASURE_RE.exec(rest);
  if (measure) {
    const name = cleanName(rest.slice(measure[0].length));
    return name ? { name, amount: null, unit: null, text: `${qty} ${measure[1].toLowerCase()}`.slice(0, INGREDIENT_TEXT_MAX) } : null;
  }
  const unit = UNIT_RE.exec(rest);
  let ing: Ingredient;
  if (unit) {
    const { unit: u, factor } = unitOf(unit[1]);
    rest = rest.slice(unit[0].length);
    ing = { name: cleanName(rest), amount: amount * factor, unit: u, text: null };
  } else {
    // "2 zanahorias": unidades.
    ing = { name: cleanName(rest.replace(/^de\s+/i, '')), amount, unit: 'ud', text: null };
  }
  if (!ing.name) return null;
  if (!Number.isFinite(ing.amount) || !ing.amount || ing.amount <= 0 || ing.amount > 100_000) {
    return { name: ing.name, amount: null, unit: null, text: qty.slice(0, INGREDIENT_TEXT_MAX) };
  }
  ing.amount = Math.round(ing.amount * 1000) / 1000;
  return ing;
}
