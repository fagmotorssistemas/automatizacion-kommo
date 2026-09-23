import { modelFamily, normalizeModelText } from '../catalog/clasificar-filas';

/** Marcas y familias que hay HOY en patio. No se copian en código. */
export type VehicleLexicon = {
  brands: string[];
  models: { brand: string; family: string }[];
};

export type FuzzyHit = {
  name: string;
  index: number;
};

const FUZZY_STOP = new Set([
  'foto',
  'fotos',
  'fotito',
  'fotitos',
  'precio',
  'precios',
  'vale',
  'cuesta',
  'cuanto',
  'hola',
  'okey',
  'favor',
  'tiene',
  'tengo',
  'hay',
  'este',
  'esta',
  'esto',
  'eso',
  'ese',
  'esa',
  'mismo',
  'auto',
  'autos',
  'carro',
  'carros',
  'color',
  'blanco',
  'negra',
  'negro',
  'ayuda',
  'ayudeme',
  'busco',
  'buscar',
  'buscando',
]);

export function emptyLexicon(): VehicleLexicon {
  return { brands: [], models: [] };
}

export function buildLexicon(
  rows: Array<{ brand: string | null; model: string | null }>,
): VehicleLexicon {
  const brands = new Set<string>();
  const models = new Map<string, { brand: string; family: string }>();
  for (const row of rows) {
    const brand = fold(String(row.brand ?? '')).trim();
    if (brand) {
      brands.add(brand);
    }
    const family = modelFamily(String(row.model ?? ''));
    if (brand && family) {
      models.set(`${brand}|${family}`, { brand, family });
    }
  }
  return { brands: [...brands], models: [...models.values()] };
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function soften(value: string): string {
  return value
    .replace(/ph/g, 'f')
    .replace(/z/g, 's')
    .replace(/v/g, 'b')
    .replace(/qu/g, 'k')
    .replace(/nn+/g, 'n')
    .replace(/ll/g, 'l');
}

function tokens(text: string): { token: string; index: number }[] {
  const folded = fold(text);
  const out: { token: string; index: number }[] = [];
  const re = /[a-z0-9]+/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(folded)) !== null) {
    out.push({ token: match[0], index: match.index });
  }
  return out;
}

/** Misma norma que el patio (d-max → dmax) y junta “d max”. */
function modelTokens(text: string): { token: string; index: number }[] {
  const base = tokens(normalizeModelText(text));
  const out = [...base];
  for (let i = 0; i < base.length - 1; i += 1) {
    out.push({
      token: `${base[i].token}${base[i + 1].token}`,
      index: base[i].index,
    });
  }
  return out;
}

function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (Math.abs(a.length - b.length) > 2) {
    return 99;
  }
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cur = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = cur;
    }
  }
  return row[b.length];
}

function maxDistance(len: number): number {
  if (len < 5) {
    return 0;
  }
  return len <= 6 ? 1 : 2;
}

function closeEnough(token: string, key: string): boolean {
  if (token === key) {
    return true;
  }
  if (FUZZY_STOP.has(token)) {
    return false;
  }
  const allowed = maxDistance(Math.min(token.length, key.length));
  if (allowed === 0) {
    return false;
  }
  if (soften(token) === soften(key)) {
    return true;
  }
  return levenshtein(token, key) <= allowed;
}

function bestKey(token: string, keys: string[]): string | null {
  let winner: { key: string; dist: number } | null = null;
  for (const key of keys) {
    if (!closeEnough(token, key)) {
      continue;
    }
    const dist = levenshtein(token, key);
    if (!winner || dist < winner.dist) {
      winner = { key, dist };
    } else if (dist === winner.dist && key !== winner.key) {
      return null;
    }
  }
  return winner?.key ?? null;
}

function phraseIndex(text: string, phrase: string): number {
  const folded = fold(text);
  const escaped = phrase
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  const match = folded.match(new RegExp(`\\b${escaped}\\b`, 'i'));
  return match?.index ?? -1;
}

export function fuzzyBrandHits(
  text: string,
  lexicon: VehicleLexicon,
): FuzzyHit[] {
  const hits: FuzzyHit[] = [];
  for (const brand of lexicon.brands) {
    const index = phraseIndex(text, brand);
    if (index >= 0) {
      hits.push({ name: brand, index });
    }
  }
  const keys = lexicon.brands.flatMap((brand) =>
    brand.split(/\s+/).filter((part) => part.length >= 3),
  );
  for (const { token, index } of tokens(text)) {
    const match = bestKey(token, [...lexicon.brands, ...keys]);
    if (!match) {
      continue;
    }
    const name =
      lexicon.brands.find((brand) => brand === match) ??
      lexicon.brands.find((brand) => brand.split(/\s+/).includes(match));
    if (name) {
      hits.push({ name, index });
    }
  }
  return hits;
}

export function fuzzyModelHits(
  text: string,
  lexicon: VehicleLexicon,
): Array<FuzzyHit & { brand: string }> {
  const hits: Array<FuzzyHit & { brand: string }> = [];
  const families = [...new Set(lexicon.models.map((row) => row.family))];
  for (const family of families) {
    const index = phraseIndex(normalizeModelText(text), family);
    if (index >= 0) {
      const rows = lexicon.models.filter((row) => row.family === family);
      if (rows.length > 0) {
        hits.push({ name: family, brand: rows[0].brand, index });
      }
    }
  }
  for (const { token, index } of modelTokens(text)) {
    const match = bestKey(token, families);
    if (!match) {
      continue;
    }
    const rows = lexicon.models.filter((row) => row.family === match);
    if (rows.length === 0) {
      continue;
    }
    hits.push({ name: match, brand: rows[0].brand, index });
  }
  return hits;
}

export function brandsOfFamily(
  lexicon: VehicleLexicon,
  family: string,
): string[] {
  return [
    ...new Set(
      lexicon.models
        .filter((row) => row.family === family)
        .map((row) => row.brand),
    ),
  ];
}
