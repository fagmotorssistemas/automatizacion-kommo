/** El cliente pidió el valor del carro, no solo información. */
export function asksForPrice(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return (
    /\bprecios?\b/.test(normalized) ||
    /\bvalor(?:es)?\b/.test(normalized) ||
    /\b(?:q|que|k)\s+vale\b/.test(normalized) ||
    /\bcuant[oa]s?\s+(?:cuesta|valen?|sale|queda|es)\b/.test(normalized) ||
    /\ba\s+como\s+(?:esta|queda|sale|vale)\b/.test(normalized)
  );
}
