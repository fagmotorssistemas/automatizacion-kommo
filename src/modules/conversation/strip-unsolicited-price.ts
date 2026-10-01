import { sanitizePlateShort } from '../catalog/plate-short';

export type StripUnsolicitedOptions = {
  keepPrice?: boolean;
  keepPlateShort?: boolean;
};

/** 0 o vacío = el patio aún no cargó el precio. No es que el carro cueste $0. */
export function hasLoadedPrice(price: number | null | undefined): boolean {
  return typeof price === 'number' && Number.isFinite(price) && price > 0;
}

/** Tras quitar el $ queda un resto inútil (“El”, “El precio es”). */
export function isStrippedReplyStub(text: string): boolean {
  const n = text
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!n) {
    return true;
  }
  if (n.length < 4) {
    return true;
  }
  return /^(?:el|la|los|las|un|una|de|del|es|precio|valor)(?:\s+(?:el|la|los|las|un|una|de|del|es|precio|valor))*$/.test(
    n,
  );
}

export const PRICE_UNLOADED =
  'El precio de esta unidad aún no está cargado en patio. En un momento un asesor le confirma el valor.';

/** $0 / $00 no es un valor real. */
export function stripZeroListedPrice(text: string): string {
  const stripped = text
    .replace(/\$\s*0+(?:[.,]0+)?\b/g, '')
    .replace(
      /\b(?:el\s+)?(?:precio|valor)\s+(?:es\s+)?(?:de\s+)?0+(?:[.,]0+)?\b/gi,
      '',
    );
  // Si no se quitó ningún monto no hay huecos que arreglar: no se toca el texto.
  if (stripped === text) {
    return text;
  }
  return tidyStrippedPriceHoles(
    stripped
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+\./g, '.')
      .trim(),
  );
}

export function replySaidPriceUnloaded(text: string): boolean {
  return /a[uú]n no est[aá] cargado|no tenemos el precio cargado/.test(
    text.toLowerCase(),
  );
}

/** Si el patio sí tiene $, no dejamos el “aún no está cargado”. */
export function stripUnloadedPriceClaim(text: string): string {
  return text
    .replace(/[^.?!]*no tenemos el precio cargado[^.?!]*[.?!]?/gi, '')
    .replace(/[^.?!]*a[uú]n no est[aá] cargado[^.?!]*[.?!]?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Quita cualquier $ / “precio de 18500”. No deja un número inventado. */
export function stripListedPriceAmounts(text: string): string {
  const withoutZero = stripZeroListedPrice(text);
  const stripped = withoutZero
    .replace(
      /(?:\s+y)?\s*\b(?:precio(?:\s+de)?|vale|cuesta|sale|queda)\s*(?:en\s*)?\$?\s*(?:\d{1,3}(?:[.,]\d{3})+|\d{4,6})(?:[.,]\d{2})?\b/gi,
      '',
    )
    .replace(/\$\s*\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?/g, '')
    .replace(/\$\s*\d{4,6}(?:[.,]\d{2})?\b/g, '')
    .replace(/\$\s*\d{1,4}[.,]\d{2}\b/g, '')
    .replace(/\b(?:y\s+)?precio\s+de\b(?!\s+esta\s+unidad)/gi, '');
  return stripped === withoutZero ? withoutZero : tidyStrippedPriceHoles(stripped);
}

function amountSpellings(price: number): string[] {
  const raw = String(Math.round(price));
  return [
    raw,
    raw.replace(/\B(?=(\d{3})+(?!\d))/g, ','),
    raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
  ];
}

/** La frase ya trae entrada, cuota o financiamiento: no se le recortan los montos. */
export function replyCarriesFinancing(text: string): boolean {
  return /\b(?:cuota|mensual(?:es)?|financi\w*|entrada)\b/i.test(text);
}

export function mentionsAmount(text: string, price: number): boolean {
  const amount = Math.round(price);
  if (!Number.isFinite(amount) || amount <= 0) {
    return false;
  }
  return amountSpellings(amount).some((v) =>
    new RegExp(`(?<![\\d.,])${v.replace(/[.,]/g, '\\$&')}(?!\\d)`).test(text),
  );
}

/** Quita solo el precio de contado de ESA unidad. Entrada, cuota y financiamiento se quedan. */
export function stripShownUnitCashPrice(text: string, price: number): string {
  const amount = Math.round(price);
  if (!Number.isFinite(amount) || amount <= 0) {
    return text;
  }
  let out = text;
  for (const spelling of amountSpellings(amount)) {
    const token = spelling.replace(/[.,]/g, '\\$&');
    out = out.replace(
      new RegExp(
        `(?:\\s+y)?\\s*\\b(?:precio(?:\\s+de)?|vale|cuesta|sale|queda)\\s*(?:en\\s*)?\\$?\\s*${token}\\b`,
        'gi',
      ),
      '',
    );
    out = out.replace(new RegExp(`\\$\\s*${token}\\b`, 'g'), '');
  }
  return out
    .replace(/\b(?:y\s+)?precio\s+de\s*(?=[.,]|$)/gi, '')
    .replace(/\best[aá]\s+en\s*[.,]/gi, '.')
    .replace(/\bes\s*[.,]/gi, '.')
    .replace(/\btiene\s+un\s*[.,]\s*/gi, '')
    .replace(/\s+y\s*[.,]/gi, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .trim();
}

export function appendUnloadedPrice(text: string): string {
  const body = stripListedPriceAmounts(stripUnloadedPriceClaim(text)).trim();
  return body ? `${body}\n\n${PRICE_UNLOADED}` : PRICE_UNLOADED;
}

/** Quita precio o placa corta si el cliente no los pidió. Siempre quita placa larga y chasis. */
export function stripUnsolicitedPriceAndPlate(
  text: string,
  options?: StripUnsolicitedOptions,
): string {
  let out = stripZeroListedPrice(text);
  const keepPrice = options?.keepPrice === true;
  const keepPlateShort = options?.keepPlateShort !== false;

  if (!keepPrice) {
    out = stripListedPriceAmounts(out);
  }

  // inventory_id / UUID: nunca va al cliente (a veces lo pegan como “placa”).
  out = out.replace(
    /\b(?:la\s+)?placa\s*(?:es|:)?\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.?/gi,
    '',
  );
  out = out.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '',
  );
  // El modelo copia el primer bloque hex del UUID (62434e00) y el strip del UUID completo no lo ve.
  out = out.replace(
    /\b((?:la\s+)?placa\s*(?:es|:)?)\s*([A-Za-z0-9-]{2,})\b\.?/gi,
    (full, label: string, token: string) => {
      const short = sanitizePlateShort(token);
      return short ? `${label} ${short}` : '';
    },
  );
  out = out.replace(/\b[0-9a-f]{8}\b/gi, (token) =>
    /^[0-9a-f]{8}$/i.test(token) && /[a-f]/i.test(token) ? '' : token,
  );
  out = out.replace(/\b(?:la\s+)?placa\s*(?:es|:)?\s*[.,]/gi, '.');

  // Placa completa (PDW7157, JYQ-3454, PIM0072). Nunca la larga.
  out = out.replace(
    /\b(?:la\s+)?placa\s*(?:es|:)?\s*[A-Za-z]{2,3}-?\d{3,4}[A-Za-z0-9]?\b\.?/gi,
    '',
  );
  out = out.replace(/\b[A-Za-z]{3}-?\d{3,4}\b/g, '');
  out = out.replace(/\bchasis\s*(?:es|:)?\s*[A-Z0-9-]{5,}\b\.?/gi, '');

  if (!keepPlateShort) {
    out = out.replace(
      /\b(?:la\s+)?placa\s*(?:es|:)?\s*[A-Z]\d\b\.?/gi,
      '',
    );
  }

  return out
    .replace(/\s+a\s*;/gi, ';')
    .replace(/\s+a\s*,/gi, ',')
    .replace(/\s+y\s*[.,]/gi, '.')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/\s+;/g, ';')
    .replace(/,\s*\./g, '.')
    .replace(/;\s*\./g, '.')
    .replace(/\.\s*,/g, '.')
    .replace(/\.\s*\./g, '.')
    .trim();
}

/** Quita “es de .”, “entrada de y”, “por al contado” cuando se recortó el monto. */
function tidyStrippedPriceHoles(text: string): string {
  return text
    .replace(/\bdisponible\s+por\s+(?:al\s+)?contado\b/gi, 'disponible')
    .replace(/\bpor\s+al\s+contado\b/gi, '')
    .replace(/\b(?:el\s+)?precio\s+de\s+contado\s+es\s+de\s*[.,]?\s*/gi, '')
    .replace(/\b(?:el\s+)?precio(?:\s+registrado)?\s+es\s*[.,]?\s*/gi, '')
    .replace(/\best[aá]\s+en\s*[.,]/gi, '.')
    .replace(/\bes\s+de\s*[.,]/gi, '.')
    .replace(/\btiene\s+un\s*[.,]\s*/gi, '')
    .replace(/\bde\s+[.,]/g, '.')
    .replace(/\bpor\s+[.,]/gi, '.')
    .replace(/\bcontado\s+del\b[^.]*\s+[.,]/gi, '')
    .replace(/\s+[.,](\s)/g, '.$1');
}

export function messageLeaksPrice(text: string): boolean {
  return (
    /\$\s*\d/.test(text) ||
    /\bprecio\s+(?:de\s+)?\$?\d/i.test(text) ||
    /\b(?:vale|cuesta)\s+\$?\d/i.test(text)
  );
}

export function asksForPlate(text: string): boolean {
  return /\bplacas?\b/i.test(text);
}

export type ListedSetUnit = {
  year?: number | null;
  color?: string | null;
  mileage?: number | null;
  price: number;
};

const LISTED_AMOUNT_RE =
  /\$\s*(?:\d{1,3}(?:[.,]\d{3})+|\d{4,6})(?:[.,]\d{2})?/g;

function formatListedUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

function parseListedAmount(token: string): number | null {
  const raw = token.replace(/[^\d.,]/g, '');
  if (!raw) {
    return null;
  }
  const grouped = raw.replace(/[.,](?=\d{3}(?:[.,]|$))/g, '');
  const whole = grouped.replace(/[.,]\d+$/, '');
  const n = Number(whole);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function unitMentionIndex(text: string, unit: ListedSetUnit): number {
  if (unit.year != null) {
    const hit = new RegExp(`\\b${unit.year}\\b`).exec(text);
    if (hit) {
      return hit.index;
    }
  }
  if (typeof unit.mileage === 'number' && unit.mileage > 0) {
    const i = text.indexOf(String(Math.round(unit.mileage)));
    if (i >= 0) {
      return i;
    }
  }
  return Number.POSITIVE_INFINITY;
}

/** Fichas del patio en la revisión (`precio=$68800`). */
export function parsePricedUnitsFromReview(text: string): ListedSetUnit[] {
  const out: ListedSetUnit[] = [];
  for (const block of text.split(/(?=modelo=)/)) {
    const price = Number(block.match(/precio=\$(\d+)/)?.[1]);
    if (!Number.isFinite(price) || price <= 0) {
      continue;
    }
    const year = Number(block.match(/año=(\d{4})/)?.[1]);
    const color = block.match(/color=([^|\n]+)/)?.[1]?.trim() ?? null;
    const mileage = Number(block.match(/km=(\d+)/)?.[1]);
    out.push({
      price: Math.round(price),
      year: Number.isFinite(year) ? year : null,
      color: color && !/^sin /i.test(color) ? color : null,
      mileage: Number.isFinite(mileage) ? mileage : null,
    });
  }
  return out;
}

/**
 * Listado de varias unidades: el modelo no puede inventar un $.
 * Se pegan los montos de patio en el orden en que nombra cada carro.
 */
export function ensureListedSetPrices(
  text: string,
  units: ListedSetUnit[],
): string {
  const priced = units.filter(
    (unit) => Number.isFinite(unit.price) && unit.price > 0,
  );
  if (priced.length === 0) {
    return stripListedPriceAmounts(text);
  }

  const allowed = new Set(priced.map((unit) => Math.round(unit.price)));
  const found = [...text.matchAll(LISTED_AMOUNT_RE)]
    .map((match) => parseListedAmount(match[0]))
    .filter((n): n is number => n != null);
  const allGood =
    found.length === priced.length &&
    found.every((n) => allowed.has(n)) &&
    priced.every((unit) => mentionsAmount(text, Math.round(unit.price)));
  if (allGood) {
    return text;
  }

  const ordered = [...priced].sort(
    (a, b) => unitMentionIndex(text, a) - unitMentionIndex(text, b),
  );
  let i = 0;
  let out = text.replace(LISTED_AMOUNT_RE, () => {
    const unit = ordered[i];
    if (!unit) {
      return '';
    }
    i += 1;
    return formatListedUsd(unit.price);
  });

  while (i < ordered.length) {
    const unit = ordered[i];
    i += 1;
    const amount = Math.round(unit.price);
    if (mentionsAmount(out, amount)) {
      continue;
    }
    const year = unit.year != null ? String(unit.year) : '';
    const yearAt = year ? out.search(new RegExp(`\\b${year}\\b`)) : -1;
    if (yearAt < 0) {
      continue;
    }
    const afterYear = yearAt + year.length;
    const tail = out.slice(afterYear);
    const cut = tail.search(
      /\s*(?:está\s+en|en)?\s*(?:[,.]?\s+y\s+el\b|[.,]|¿|\?)/i,
    );
    const at = cut >= 0 ? afterYear + cut : afterYear;
    const rest = out.slice(at).replace(/^\s*(?:está\s+en|en)\s*/i, ' ');
    out = `${out.slice(0, at).replace(/\s+$/, '')} está en ${formatListedUsd(amount)}${rest}`;
  }

  return tidyStrippedPriceHoles(
    stripAmountsOutside(out, allowed)
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+,/g, ',')
      .replace(/\s+\./g, '.')
      .trim(),
  );
}

function stripAmountsOutside(text: string, allowed: Set<number>): string {
  return text.replace(LISTED_AMOUNT_RE, (token) => {
    const n = parseListedAmount(token);
    return n != null && allowed.has(n) ? token : '';
  });
}
