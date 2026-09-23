import { modelFamily } from '../catalog/clasificar-filas';

const BRANDS: { name: string; pattern: RegExp }[] = [
  { name: 'great wall', pattern: /\bgreat\s*wall\b|\bgwm\b/gi },
  { name: 'mercedes benz', pattern: /\bmercedez?(?:\s*benz)?\b/gi },
  { name: 'volkswagen', pattern: /\bvolkswagen\b|\bvw\b/gi },
  { name: 'zx auto', pattern: /\bzx(?:\s*auto)?\b/gi },
  { name: 'chevrolet', pattern: /\bchevrolet\b|\bchevy\b|\bchebrole[ct]s?\b/gi },
  { name: 'citroen', pattern: /\bcitro[eë]n\b/gi },
  { name: 'mitsubishi', pattern: /\bmitsubishi\b/gi },
  { name: 'peugeot', pattern: /\bpeugeot\b/gi },
  { name: 'hyundai', pattern: /\bhyundai\b/gi },
  { name: 'toyota', pattern: /\btoyota\b/gi },
  { name: 'nissan', pattern: /\bnissans?\b/gi },
  { name: 'suzuki', pattern: /\bsuzuki\b/gi },
  { name: 'jetour', pattern: /\bjetour\b/gi },
  { name: 'changan', pattern: /\bchangan\b/gi },
  { name: 'chery', pattern: /\bchery\b/gi },
  { name: 'foton', pattern: /\bfot[oó]n\b/gi },
  { name: 'mazda', pattern: /\bmazda\b/gi },
  { name: 'ford', pattern: /\bford\b/gi },
  { name: 'kia', pattern: /\bkia\b/gi },
  { name: 'jac', pattern: /\bjac\b/gi },
  { name: 'fiat', pattern: /\bfiat\b/gi },
  { name: 'faw', pattern: /\bfaw\b/gi },
  { name: 'audi', pattern: /\baudi\b/gi },
  { name: 'ram', pattern: /\bram\b/gi },
  { name: 'mini', pattern: /\bmini\b/gi },
  { name: 'byd', pattern: /\bbyd\b/gi },
];

const TRES_FILAS =
  /\b(?:3|tres)\s+filas?\b|\b7\s*pasajeros?\b|\bsiete\s+pasajeros?\b/i;

/** Modelo inequívoco → marca. "Hilux" es Toyota aunque no la nombren. */
const MODEL_BRANDS: { brand: string; pattern: RegExp }[] = [
  { brand: 'toyota', pattern: /\b(?:hilux|hilus|prado|fortuner|4[\s-]*runner|rav4|yaris|corolla|land\s*cruiser)\b/gi },
  { brand: 'ford', pattern: /\b(?:ranger|explorer|escape|f[\s-]?150)\b/gi },
  { brand: 'kia', pattern: /\b(?:seltos|sportage|picanto|rio|sorento|cerato)\b/gi },
  { brand: 'nissan', pattern: /\b(?:frontier|np300|navara|sentra|versa|kicks|x[\s-]?trail)\b/gi },
  { brand: 'chevrolet', pattern: /\b(?:d[\s-]?max|colorado|tracker|aveo|optra|sail|spark)\b/gi },
  { brand: 'volkswagen', pattern: /\b(?:t[\s-]?cross|tiguan|amarok|vento|jetta)\b/gi },
  { brand: 'hyundai', pattern: /\b(?:tucson|accent|creta|santa\s*fe|ix\s*35)\b/gi },
  { brand: 'mazda', pattern: /\b(?:bt[\s-]?50|cx[\s-]?5|cx[\s-]?30)\b/gi },
  { brand: 'great wall', pattern: /\b(?:poer|wingle)\b/gi },
  { brand: 'mitsubishi', pattern: /\b(?:l200|montero)\b/gi },
  { brand: 'suzuki', pattern: /\b(?:jimny|vitara|swift)\b/gi },
  { brand: 'foton', pattern: /\btunland\b/gi },
];

function foldAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function detectBrandFromModel(text: string): string | null {
  const folded = foldAccents(text);
  let winner: { brand: string; index: number } | null = null;
  for (const row of MODEL_BRANDS) {
    row.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = row.pattern.exec(folded)) !== null) {
      if (!winner || match.index >= winner.index) {
        winner = { brand: row.brand, index: match.index };
      }
    }
  }
  return winner?.brand ?? null;
}

function detectBrandName(text: string): string | null {
  let winner: { name: string; index: number } | null = null;

  for (const brand of BRANDS) {
    brand.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = brand.pattern.exec(text)) !== null) {
      if (!winner || match.index >= winner.index) {
        winner = { name: brand.name, index: match.index };
      }
    }
  }

  return winner?.name ?? null;
}

export function detectBrand(text: string): string | null {
  return detectBrandFromModel(text) ?? detectBrandName(text);
}

export type NamedModelAsk = {
  brand: string;
  family: string;
  year: number | null;
};

/** Último modelo concreto del mensaje (Sportage, Tucson) y año si lo dijo. */
export function detectNamedModelAsk(text: string): NamedModelAsk | null {
  const folded = foldAccents(text);
  let winner: { brand: string; family: string; index: number } | null = null;
  for (const row of MODEL_BRANDS) {
    row.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = row.pattern.exec(folded)) !== null) {
      const family = modelFamily(match[0]);
      if (!family) {
        continue;
      }
      if (!winner || match.index >= winner.index) {
        winner = { brand: row.brand, family, index: match.index };
      }
    }
  }
  if (!winner) {
    return null;
  }
  const yearHit = folded.match(/\b((?:19|20)\d{2})\b/);
  const year = yearHit ? Number(yearHit[1]) : null;
  return {
    brand: winner.brand,
    family: winner.family,
    year: year && year >= 1990 && year <= 2035 ? year : null,
  };
}

export function resolveBrand(input: {
  history: { role: string; content: string }[];
  customerText: string;
  remembered: string | null;
}): string | null {
  let brand = input.remembered;
  const texts = [
    ...input.history
      .filter((item) => item.role === 'user')
      .map((item) => item.content),
    input.customerText,
  ];

  for (const text of texts) {
    const found = detectBrand(text);
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
