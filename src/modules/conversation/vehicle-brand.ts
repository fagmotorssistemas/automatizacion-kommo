import { modelFamily } from '../catalog/clasificar-filas';
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

function lastModelHit(
  text: string,
  lexicon: VehicleLexicon,
): { brand: string; family: string; index: number } | null {
  let named: { brand: string; family: string; index: number } | null = null;
  let numeric: { brand: string; family: string; index: number } | null = null;
  for (const hit of fuzzyModelHits(text, lexicon)) {
    const family = modelFamily(hit.name);
    if (!family) {
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

/** Último modelo concreto del mensaje (Sportage, Tucson) y año si lo dijo. */
export function detectNamedModelAsk(
  text: string,
  lexicon: VehicleLexicon = emptyLexicon(),
): NamedModelAsk | null {
  const winner = lastModelHit(text, lexicon);
  if (!winner) {
    return null;
  }
  const near = brandBeforeModel(text, winner.index, lexicon);
  const brands = brandsOfFamily(lexicon, winner.family);
  const year = detectYearInText(text);
  return {
    brand: near ?? (brands.length === 1 ? winner.brand : ''),
    family: winner.family,
    year: year && String(year) === winner.family ? null : year,
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
  const matches = [...folded.matchAll(/\b((?:19|20)\d{2})\b/g)].filter(
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
