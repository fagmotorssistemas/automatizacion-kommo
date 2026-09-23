export type StripUnsolicitedOptions = {
  keepPrice?: boolean;
  keepPlateShort?: boolean;
};

/** Quita precio o placa corta si el cliente no los pidió. Siempre quita placa larga y chasis. */
export function stripUnsolicitedPriceAndPlate(
  text: string,
  options?: StripUnsolicitedOptions,
): string {
  let out = text;
  const keepPrice = options?.keepPrice === true;
  const keepPlateShort = options?.keepPlateShort !== false;

  if (!keepPrice) {
    out = out.replace(
      /(?:\s+y)?\s*\b(?:precio(?:\s+de)?|vale|cuesta|sale|queda)\s*(?:en\s*)?\$?\s*(?:\d{1,3}(?:[.,]\d{3})+|\d{4,6})(?:[.,]\d{2})?\b/gi,
      '',
    );
    out = out.replace(/\$\s*\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?/g, '');
    out = out.replace(/\$\s*\d{4,6}(?:[.,]\d{2})?\b/g, '');
    out = out.replace(/\b(?:y\s+)?precio\s+de\b/gi, '');
    out = tidyStrippedPriceHoles(out);
  }

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
    .replace(/\bentrada\s+de\s+y\b/gi, 'entrada y')
    .replace(/\bes\s+de\s*[.,]/gi, '.')
    .replace(/\bde\s+[.,]/g, '.')
    .replace(/\bpor\s+[.,]/gi, '.');
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
