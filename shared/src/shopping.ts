/** Secciones del súper, en el orden en que se muestran en la lista. */
export const SHOPPING_SECTIONS = [
  'fruta_verdura',
  'carne_pescado',
  'lacteos_huevos',
  'panaderia',
  'despensa',
  'congelados',
  'bebidas',
  'limpieza',
  'higiene',
  'otros',
] as const;
export type ShoppingSection = (typeof SHOPPING_SECTIONS)[number];

export const SHOPPING_SECTION_LABELS: Record<ShoppingSection, string> = {
  fruta_verdura: 'Fruta y verdura',
  carne_pescado: 'Carne y pescado',
  lacteos_huevos: 'Lácteos y huevos',
  panaderia: 'Panadería',
  despensa: 'Despensa',
  congelados: 'Congelados',
  bebidas: 'Bebidas',
  limpieza: 'Limpieza',
  higiene: 'Higiene',
  otros: 'Otros',
};

export const SHOPPING_NAME_MAX = 80;
export const SHOPPING_QUANTITY_MAX = 30;

export interface ShoppingItem {
  id: string;
  name: string;
  /** Texto libre: "2", "1 kg", "una caja grande"… */
  quantity: string | null;
  section: ShoppingSection;
  /** Ya está en el carro. */
  done: boolean;
  addedById: string;
  createdAt: string;
}

export interface ShoppingItemInput {
  name: string;
  quantity?: string | null;
  /** Si no se indica, la que se usó la última vez para ese producto o la que se adivina por el nombre. */
  section?: ShoppingSection;
}

export interface ShoppingItemPatch {
  name?: string;
  quantity?: string | null;
  section?: ShoppingSection;
  done?: boolean;
}

/** Producto que ya se ha comprado en la casa: sirve para sugerir y para los habituales. */
export interface ShoppingProduct {
  /** Nombre normalizado (ver productKey). */
  key: string;
  name: string;
  section: ShoppingSection;
  quantity: string | null;
  /** Veces que se ha añadido a la lista. */
  count: number;
}

/**
 * Nombre bien escrito: "leche" y "LECHE" pasan a "Leche". Si mezcla mayúsculas y minúsculas
 * se respeta ("Pilas AAA", "Coca-Cola") y solo se pone en mayúscula la primera letra.
 */
export function tidyName(name: string): string {
  const text = name.trim().replace(/\s+/g, ' ');
  const uniform = text === text.toLocaleLowerCase('es') || text === text.toLocaleUpperCase('es');
  const rest = uniform ? text.slice(1).toLocaleLowerCase('es') : text.slice(1);
  return text.charAt(0).toLocaleUpperCase('es') + rest;
}

/** Clave para comparar nombres: minúsculas, sin tildes y sin espacios de más. "Plátanos " → "platanos". */
export function productKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Palabras con las que se adivina la sección de un producto nuevo. Se compara el principio de
 * cada palabra ("manzana" vale para "manzanas"). Gana la que aparece antes en el nombre, porque
 * suele mandar la primera ("salsa de tomate", "pasta de dientes"), y si empiezan igual, la más
 * larga: "tomate frito" va a Despensa aunque "tomate" sea Fruta y verdura.
 */
const SECTION_WORDS: Record<Exclude<ShoppingSection, 'otros'>, string[]> = {
  fruta_verdura: [
    'fruta', 'verdura', 'manzana', 'platano', 'naranja', 'mandarina', 'limon', 'lima', 'pera', 'uva', 'fresa', 'melon',
    'sandia', 'kiwi', 'pina', 'melocoton', 'nectarina', 'cereza', 'ciruela', 'mango', 'aguacate', 'tomate', 'lechuga',
    'cebolla', 'cebolleta', 'ajo', 'patata', 'zanahoria', 'pimiento', 'calabacin', 'calabaza', 'berenjena', 'pepino',
    'espinaca', 'acelga', 'brocoli', 'coliflor', 'col ', 'repollo', 'judia verde', 'judias verdes', 'champinon', 'seta',
    'puerro', 'apio', 'alcachofa', 'esparrago', 'perejil', 'cilantro', 'albahaca', 'hierbabuena', 'rucula', 'canonigo',
    'ensalada', 'jengibre', 'boniato', 'remolacha', 'rabano', 'arandano', 'frambuesa', 'higo', 'granada',
  ],
  carne_pescado: [
    'carne', 'pollo', 'ternera', 'cerdo', 'filete', 'pechuga', 'muslo', 'alita', 'hamburguesa', 'salchicha', 'chorizo',
    'jamon', 'lomo', 'bacon', 'beicon', 'pavo', 'cordero', 'conejo', 'costilla', 'solomillo', 'carne picada', 'morcilla',
    'embutido', 'fiambre', 'salchichon', 'fuet', 'pate', 'pescado', 'merluza', 'salmon', 'bacalao', 'gamba', 'langostino',
    'calamar', 'sepia', 'pulpo', 'mejillon', 'almeja', 'dorada', 'lubina', 'sardina', 'boqueron', 'rape', 'emperador',
    'atun fresco', 'marisco',
  ],
  lacteos_huevos: [
    'leche', 'yogur', 'queso', 'mantequilla', 'nata', 'huevo', 'kefir', 'cuajada', 'flan', 'natillas', 'margarina',
    'requeson', 'mozzarella', 'burrata', 'batido', 'bebida de avena', 'bebida de soja', 'bebida vegetal',
  ],
  panaderia: [
    'pan', 'barra', 'baguette', 'chapata', 'hogaza', 'pan de molde', 'tostada', 'biscote', 'croissant', 'cruasan',
    'bolleria', 'magdalena', 'bizcocho', 'napolitana', 'tortita', 'tortilla de trigo', 'pan rallado',
  ],
  despensa: [
    'arroz', 'pasta', 'macarron', 'espagueti', 'fideo', 'tallarin', 'lasana', 'harina', 'azucar', 'sal', 'aceite',
    'vinagre', 'legumbre', 'lenteja', 'garbanzo', 'alubia', 'atun', 'conserva', 'lata', 'tomate frito', 'tomate triturado',
    'salsa', 'especia', 'pimienta', 'oregano', 'pimenton', 'comino', 'canela', 'cafe', 'te ', 'infusion', 'manzanilla',
    'cacao', 'colacao', 'cereal', 'avena', 'muesli', 'galleta', 'chocolate', 'mermelada', 'miel', 'frutos secos', 'nuez',
    'nueces', 'almendra', 'cacahuete', 'pipa', 'pasa', 'caldo', 'pastilla de caldo', 'levadura', 'mayonesa', 'ketchup',
    'mostaza', 'aceituna', 'maiz', 'patatas fritas', 'snack', 'palomitas', 'pure', 'gazpacho', 'tomate seco', 'quinoa',
    'cuscus', 'soja', 'edulcorante', 'sirope',
  ],
  congelados: ['congelad', 'helado', 'pizza', 'hielo', 'croqueta', 'varitas', 'nugget', 'empanadilla', 'polo'],
  bebidas: [
    'agua', 'zumo', 'refresco', 'cola', 'coca', 'fanta', 'cerveza', 'vino', 'cava', 'gaseosa', 'tonica', 'bebida',
    'isotonic', 'sidra', 'vermut', 'licor', 'ginebra', 'ron ', 'whisky', 'mosto', 'kombucha',
  ],
  limpieza: [
    'lejia', 'detergente', 'suavizante', 'friegasuelos', 'lavavajillas', 'fregona', 'bayeta', 'estropajo', 'papel de cocina',
    'rollo de cocina', 'servilleta', 'bolsa de basura', 'bolsas de basura', 'limpiador', 'limpiacristales', 'amoniaco',
    'desengrasante', 'quitagrasas', 'ambientador', 'insecticida', 'papel de aluminio', 'papel aluminio', 'film', 'quitamanchas',
    'jabon de ropa', 'cápsulas', 'capsulas de lavadora', 'sal de lavavajillas', 'abrillantador', 'guantes', 'cubo',
  ],
  higiene: [
    'champu', 'gel', 'jabon', 'desodorante', 'pasta de dientes', 'dentifrico', 'cepillo de dientes', 'papel higienico',
    'compresa', 'tampon', 'cuchilla', 'maquinilla', 'crema', 'colonia', 'perfume', 'algodon', 'bastoncillo', 'toallita',
    'panal', 'enjuague', 'colutorio', 'hilo dental', 'protector solar', 'after sun', 'acondicionador', 'mascarilla',
    'pañuelo', 'panuelo', 'tirita', 'espuma de afeitar', 'laca', 'gomina', 'cera',
  ],
};

/** Sección que parece más probable para un producto por su nombre; "otros" si no se reconoce. */
export function guessSection(name: string): ShoppingSection {
  // Espacios alrededor para que "col " o "te " no casen dentro de "coliflor" o "tomate".
  const text = ` ${productKey(name)} `;
  let best: ShoppingSection = 'otros';
  let bestAt = Infinity;
  let bestLength = 0;
  for (const [section, words] of Object.entries(SECTION_WORDS) as [ShoppingSection, string[]][]) {
    for (const word of words) {
      const w = productKey(word) + (word.endsWith(' ') ? ' ' : '');
      const at = text.indexOf(' ' + w);
      if (at >= 0 && (at < bestAt || (at === bestAt && w.length > bestLength))) {
        best = section;
        bestAt = at;
        bestLength = w.length;
      }
    }
  }
  return best;
}
