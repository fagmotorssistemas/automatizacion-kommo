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
      /\b(?:precio(?:\s+de)?|vale|cuesta|sale|queda)\s*(?:en\s*)?\$?\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\b/gi,
      '',
    );
    out = out.replace(/\$\s*\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?/g, '');
    out = out.replace(/\$\s*\d{4,6}(?:[.,]\d{2})?\b/g, '');
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
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*\./g, '.')
    .replace(/\.\s*,/g, '.')
    .replace(/\.\s*\./g, '.')
    .trim();
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
