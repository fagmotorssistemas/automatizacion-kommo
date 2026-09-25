import { modelFamily, normalizeModelText } from '../catalog/clasificar-filas';
import {
  brandsOfFamily,
  emptyLexicon,
  fuzzyBrandHits,
  fuzzyModelHits,
  type VehicleLexicon,
} from './fuzzy-vehicle-name';

export type { VehicleLexicon };

const TRES_FILAS =
  /\b(?:3|tres)\s+filas?\b|\b7\s*pasajeros?\b|\bsiete\s+pasajeros?\b/i;

const COLORS: { name: string; pattern: RegExp }[] = [
  { name: 'blanco', pattern: /\bblanc[oa]s?\b/gi },
  { name: 'negro', pattern: /\bnegr[oa]s?\b/gi },
  { name: 'rojo', pattern: /\broj[oa]s?\b/gi },
  { name: 'azul', pattern: /\bazules?\b/gi },
  { name: 'plomo', pattern: /\bplomos?\b/gi },
  { name: 'gris', pattern: /\bgrises?\b/gi },
  { name: 'plateado', pattern: /\bplatead[oa]s?\b/gi },
  { name: 'verde', pattern: /\bverdes?\b/gi },
  { name: 'beige', pattern: /\bbeiges?\b/gi },
  { name: 'dorado', pattern: /\bdorad[oa]s?\b/gi },
  { name: 'vino', pattern: /\bvinos?\b/gi },
];

function foldAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function detectBrandFromModel(
  text: string,
  lexicon: VehicleLexicon = emptyLexicon(),
): string | null {
  return lastModelHit(text, lexicon)?.brand ?? null;
}

function isYearLikeFamily(family: string): boolean {
  return /^(?:19|20)\d{2}$/.test(family);
}

/** 4x4 / 4x2 es tracción de la ficha, no un modelo. */
export function isDriveFamily(family: string): boolean {
  return /^(?:4x[24]|x[24]|4wd|awd)$/i.test(family.trim());
}

function lastModelHit(
  text: string,
  lexicon: VehicleLexicon,
): { brand: string; family: string; index: number } | null {
  let named: { brand: string; family: string; index: number } | null = null;
  let numeric: { brand: string; family: string; index: number } | null = null;
  for (const hit of fuzzyModelHits(text, lexicon)) {
    const family = modelFamily(hit.name);
    if (!family || isDriveFamily(family)) {
      continue;
    }
    const row = { brand: hit.brand, family, index: hit.index };
    if (isYearLikeFamily(family)) {
      if (!numeric || hit.index >= numeric.index) {
        numeric = row;
      }
      continue;
    }
    if (!named || hit.index >= named.index) {
      named = row;
    }
  }
  return named ?? numeric;
}

function lastBrandHit(
  text: string,
  lexicon: VehicleLexicon,
): { name: string; index: number } | null {
  let winner: { name: string; index: number } | null = null;
  for (const hit of fuzzyBrandHits(text, lexicon)) {
    if (!winner || hit.index >= winner.index) {
      winner = { name: hit.name, index: hit.index };
    }
  }
  return winner;
}

export function detectBrand(
  text: string,
  lexicon: VehicleLexicon = emptyLexicon(),
): string | null {
  const asked = detectNamedModelAsk(text, lexicon);
  if (asked?.brand) {
    return asked.brand;
  }
  if (asked && !asked.brand) {
    return lastBrandHit(text, lexicon)?.name ?? null;
  }
  return (
    detectBrandFromModel(text, lexicon) ??
    lastBrandHit(text, lexicon)?.name ??
    null
  );
}

export type NamedModelAsk = {
  brand: string;
  family: string;
  year: number | null;
};

/**
 * Código tipo i10 / y 10 / a4 junto a una marca, aunque no esté en patio.
 * “y 10” se lee como i10 (así suena). No es año ni plazo.
 */
function letterNumberModelAsk(
  text: string,
  lexicon: VehicleLexicon,
): string | null {
  if (!lastBrandHit(text, lexicon)) {
    return null;
  }
  const folded = foldAccents(text).toLowerCase();
  const re = /\b([a-z])[\s-]?(\d{1,3})\b/gi;
  let last: string | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(folded)) !== null) {
    const raw = `${match[1]}${match[2]}`;
    const after = folded.slice(
      (match.index ?? 0) + match[0].length,
      (match.index ?? 0) + match[0].length + 14,
    );
    if (/\s*(an[io]s|meses|mil|km|dolares)/i.test(after)) {
      continue;
    }
    const prev = folded[(match.index ?? 0) - 1];
    if (prev === '4' && /^x[24]$/i.test(raw)) {
      continue;
    }
    const families = lexicon.models.map((row) => row.family);
    const alt =
      match[1] === 'y' ? `i${match[2]}` : match[1] === 'i' ? `y${match[2]}` : '';
    last = families.includes(raw)
      ? raw
      : alt && families.includes(alt)
        ? alt
        : match[1] === 'y'
          ? `i${match[2]}`
          : raw;
  }
  return last;
}

/** Año, color, caja o dato de ficha: no es un modelo. */
function isFactToken(token: string): boolean {
  if (isYearLikeFamily(token)) {
    return true;
  }
  if (detectColorInText(token)) {
    return true;
  }
  if (detectTrimInText(token)) {
    return true;
  }
  if (/^(?:autom[aá]tic[oa]s?|manual(?:es)?|mecanic[oa]s?)$/.test(token)) {
    return true;
  }
  if (isDriveFamily(token)) {
    return true;
  }
  return /^(?:filas?|pasajeros?|fotos?|videos?|recorrido|kilometraje|precios?|valores?|cuota|entrada|ubicacion|direccion|tiene|tienen|tengo|quiero|quieres|quisiera|busco|busca|buscando|hay|mas|informacion)$/.test(
    token,
  );
}

const FAMILY_TOKEN =
  /\b((?:19|20)\d{2}|[a-z][a-z0-9]+|[0-9]+[a-z][a-z0-9]*|\d{3})\b/gi;

function tokenAfter(tail: string, from: number): string | null {
  const re = new RegExp(FAMILY_TOKEN.source, 'gi');
  re.lastIndex = from;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tail)) !== null) {
    const token = match[1];
    if (isYearLikeFamily(token) || token.length <= 3) {
      continue;
    }
    return token;
  }
  return null;
}

/**
 * Modelo pegado a la marca aunque no esté en patio: “Kia sonet”.
 * Se saltan año, color y caja. Si lo que sigue es un dato (filas, fotos),
 * no se inventa un modelo con el verbo.
 */
function familyAfterLastBrand(
  text: string,
  lexicon: VehicleLexicon,
): { brand: string; family: string; index: number } | null {
  const brand = lastBrandHit(text, lexicon);
  if (!brand) {
    return null;
  }
  const folded = foldAccents(text).toLowerCase();
  const tail = normalizeModelText(folded.slice(brand.index + brand.name.length));
  const known = new Set(
    lexicon.models
      .filter((row) => row.brand === brand.name)
      .map((row) => row.family),
  );
  const re = new RegExp(FAMILY_TOKEN.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = re.exec(tail)) !== null) {
    const token = match[1];
    if (isFactToken(token)) {
      continue;
    }
    const family = modelFamily(token);
    const knownName = known.has(token)
      ? token
      : known.has(family)
        ? family
        : '';
    if (knownName) {
      return {
        brand: brand.name,
        family: knownName,
        index: brand.index + brand.name.length + (match.index ?? 0),
      };
    }
    if (family.length >= 4 || /^\d{3}$/.test(family)) {
      const next = tokenAfter(tail, (match.index ?? 0) + match[0].length);
      if (next && isFactToken(next)) {
        if (/[0-9]/.test(family) && (match.index ?? 0) <= 12) {
          return {
            brand: brand.name,
            family,
            index: brand.index + brand.name.length + (match.index ?? 0),
          };
        }
        continue;
      }
      if ((match.index ?? 0) > 40) {
        return null;
      }
      return {
        brand: brand.name,
        family,
        index: brand.index + brand.name.length + (match.index ?? 0),
      };
    }
    return null;
  }
  return null;
}

/** Último modelo concreto del mensaje (Sportage, Tucson) y año si lo dijo. */
export function detectNamedModelAsk(
  text: string,
  lexicon: VehicleLexicon = emptyLexicon(),
): NamedModelAsk | null {
  const winner = lastModelHit(text, lexicon);
  const afterBrand = familyAfterLastBrand(text, lexicon);
  const lastBrand = lastBrandHit(text, lexicon);
  const useAfter =
    afterBrand != null &&
    (!winner ||
      afterBrand.family === winner.family ||
      winner.index < (lastBrand?.index ?? 0) ||
      (/^\d{3}$/.test(afterBrand.family) &&
        afterBrand.family !== winner.family));
  const picked = useAfter ? afterBrand : winner;
  if (picked) {
    const near = brandBeforeModel(text, picked.index, lexicon);
    const brands = brandsOfFamily(lexicon, picked.family);
    const year = detectYearInText(text);
    return {
      brand: useAfter
        ? picked.brand
        : (near ?? (brands.length === 1 ? picked.brand : '')),
      family: picked.family,
      year: year && String(year) === picked.family ? null : year,
    };
  }
  const code = letterNumberModelAsk(text, lexicon);
  if (!code) {
    return null;
  }
  return {
    brand: lastBrandHit(text, lexicon)?.name ?? '',
    family: code,
    year: detectYearInText(text),
  };
}

function looksLikeMoneyAmount(text: string, index: number, raw: string): boolean {
  const around = text
    .slice(Math.max(0, index - 16), index + raw.length + 20)
    .toLowerCase();
  return (
    /\$/.test(around) ||
    /\b(entrada|inicial|dolares|mil|cuota|contado|plazo)\b/.test(around)
  );
}

export function detectYearInText(text: string): number | null {
  const folded = foldAccents(text);
  const matches = [...folded.matchAll(/\b((?:19|20)\d{2})(?!\d)/g)].filter(
    (match) => !looksLikeMoneyAmount(folded, match.index ?? 0, match[1]),
  );
  if (matches.length === 0) {
    return null;
  }
  const year = Number(matches[matches.length - 1][1]);
  return year >= 1990 && year <= 2035 ? year : null;
}

const TRIMS: { name: string; pattern: RegExp }[] = [
  { name: 'premier', pattern: /\bpremie?re?\b/gi },
  { name: 'hiride', pattern: /\bhi[\s-]?ride\b|\bhigh[\s-]?ride\b/gi },
];

export function detectTrimInText(text: string): string | null {
  const folded = foldAccents(text);
  let winner: { name: string; index: number } | null = null;
  for (const row of TRIMS) {
    row.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = row.pattern.exec(folded)) !== null) {
      if (!winner || match.index >= winner.index) {
        winner = { name: row.name, index: match.index };
      }
    }
  }
  return winner?.name ?? null;
}

export function modelHasTrim(model: string, trim: string): boolean {
  const normalized = foldAccents(model).toLowerCase().replace(/[\s-]+/g, '');
  if (trim === 'premier') {
    return normalized.includes('premier');
  }
  if (trim === 'hiride') {
    return normalized.includes('hiride') || normalized.includes('highride');
  }
  return normalized.includes(trim);
}

export function detectColorInText(text: string): string | null {
  const folded = foldAccents(text);
  let winner: { name: string; index: number } | null = null;
  for (const row of COLORS) {
    row.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = row.pattern.exec(folded)) !== null) {
      if (!winner || match.index >= winner.index) {
        winner = { name: row.name, index: match.index };
      }
    }
  }
  return winner?.name ?? null;
}

export function colorMatches(
  carColor: string | null | undefined,
  asked: string,
): boolean {
  if (!carColor || !asked) {
    return false;
  }
  return foldAccents(carColor).toLowerCase().includes(asked);
}

/** Marca dicha justo antes del modelo: "Chevrolet Grand Vitara" → chevrolet. */
function brandBeforeModel(
  text: string,
  modelIndex: number,
  lexicon: VehicleLexicon,
): string | null {
  const hit = lastBrandHit(text, lexicon);
  if (!hit || hit.index > modelIndex) {
    return null;
  }
  return hit.name;
}

export function resolveBrand(input: {
  history: { role: string; content: string }[];
  customerText: string;
  remembered: string | null;
  lexicon?: VehicleLexicon;
}): string | null {
  let brand = input.remembered;
  const lexicon = input.lexicon ?? emptyLexicon();
  const texts = [
    ...input.history
      .filter((item) => item.role === 'user')
      .map((item) => item.content),
    input.customerText,
  ];

  for (const text of texts) {
    const found = detectBrand(text, lexicon);
    if (found) {
      brand = found;
    }
  }

  return brand;
}

export function detectTresFilas(text: string): boolean {
  return TRES_FILAS.test(text);
}

export function resolveTresFilas(input: {
  history: { role: string; content: string }[];
  customerText: string;
  remembered: boolean;
}): boolean {
  if (input.remembered) {
    return true;
  }

  const texts = [
    ...input.history
      .filter((item) => item.role === 'user')
      .map((item) => item.content),
    input.customerText,
  ];
  return texts.some((text) => detectTresFilas(text));
}
