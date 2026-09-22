/** Quita el precio del texto al cliente cuando no lo pidió. Conserva plate_short. */
export function stripUnsolicitedPriceAndPlate(text: string): string {
  let out = text;

  // "precio de $21800", "a $21.800", "vale 21800 dólares", etc.
  out = out.replace(
    /\b(?:precio(?:\s+de)?|vale|cuesta|sale|queda)\s*(?:en\s*)?\$?\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\b/gi,
    '',
  );
  out = out.replace(/\$\s*\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?/g, '');
  out = out.replace(/\$\s*\d{4,6}(?:[.,]\d{2})?\b/g, '');

  // Placa completa (PDW7157). plate_short (P7) se deja.
  out = out.replace(
    /\b(?:la\s+)?placa\s*(?:es|:)?\s*[A-Z]{2,3}\d{3,4}[A-Z0-9]?\b\.?/gi,
    '',
  );
  out = out.replace(/\bchasis\s*(?:es|:)?\s*[A-Z0-9-]{5,}\b\.?/gi, '');

  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*\./g, '.')
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
