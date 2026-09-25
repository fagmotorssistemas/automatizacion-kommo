import { sanitizePlateShort } from '../catalog/plate-short';

export type StripUnsolicitedOptions = {
  keepPrice?: boolean;
  keepPlateShort?: boolean;
};

/** 0 o vacío = el patio aún no cargó el precio. No es que el carro cueste $0. */
export function hasLoadedPrice(price: number | null | undefined): boolean {
  return typeof price === 'number' && Number.isFinite(price) && price > 0;
}

export const PRICE_UNLOADED =
  'El precio de esta unidad aún no está cargado en patio. En un momento un asesor le confirma el valor.';

/** $0 / $00 no es un valor real. */
export function stripZeroListedPrice(text: string): string {
  return tidyStrippedPriceHoles(
    text
      .replace(/\$\s*0+(?:[.,]0+)?\b/g, '')
      .replace(
        /\b(?:el\s+)?(?:precio|valor)\s+(?:es\s+)?(?:de\s+)?0+(?:[.,]0+)?\b/gi,
        '',
      )
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

export function appendUnloadedPrice(text: string): string {
  const body = stripZeroListedPrice(text).trim();
  if (replySaidPriceUnloaded(body)) {
    return body;
  }
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
    out = out.replace(
      /(?:\s+y)?\s*\b(?:precio(?:\s+de)?|vale|cuesta|sale|queda)\s*(?:en\s*)?\$?\s*(?:\d{1,3}(?:[.,]\d{3})+|\d{4,6})(?:[.,]\d{2})?\b/gi,
      '',
    );
    out = out.replace(/\$\s*\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?/g, '');
    out = out.replace(/\$\s*\d{4,6}(?:[.,]\d{2})?\b/g, '');
    out = out.replace(/\$\s*\d{1,4}[.,]\d{2}\b/g, '');
    out = out.replace(/\b(?:y\s+)?precio\s+de\b/gi, '');
    out = tidyStrippedPriceHoles(out);
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
    .replace(
      /\bcon\s+una\s+entrada\s+de(?:\s+la)?(?:\s+cuota[^.?!]*)?[.?!]?/gi,
      '',
    )
    .replace(
      /\bla\s+cuota(?:\s+aproximada)?(?:\s+ser[ií]a)?(?:\s+de)?\s*[.,]?\s*/gi,
      '',
    )
    .replace(/\bentrada\s+de\s+y\b/gi, 'entrada y')
    .replace(/\bentrada\s+de(?:\s+la)?\s*/gi, '')
    .replace(/\bes\s+de\s*[.,]/gi, '.')
    .replace(/\btiene\s+un\s*[.,]\s*/gi, '')
    .replace(/\bcon\s+de\s+entrada\b/gi, '')
    .replace(/\bpara\s+financiar(?:\s+a\s+\d+\s+a[nñ]os)?\s*/gi, '')
    .replace(/\bmensuales\b/gi, '')
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
