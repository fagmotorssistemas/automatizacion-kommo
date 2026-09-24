export const DEALERSHIP_ADDRESS =
  'Estamos en Av. España 6-73 y Sevilla, Cuenca. Puede venir a ver el vehículo cuando guste; no hace falta depositar la entrada para darle la dirección ni para visitar.';

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** El bot condicionó la dirección o la visita a la entrada. */
export function replyGatesInfoOnEntrada(text: string): boolean {
  const n = fold(text);
  const pay = /\b(entrada|deposit|plata|valores)\b/.test(n);
  const first = /\b(primero|antes|confirmar?|para (?:que|poder))\b/.test(n);
  const info = /\b(direccion|ubicacion|visita)\b/.test(n);
  return pay && first && info;
}

function hasDealershipAddress(text: string): boolean {
  return /av\.?\s*espa[nñ]a/i.test(text);
}

function keepQuotedFacts(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => {
      const n = fold(sentence);
      if (replyGatesInfoOnEntrada(sentence)) {
        return false;
      }
      return /\$\s*\d/.test(sentence) && /\b(cuota|mensual)\b/.test(n);
    })
    .join(' ')
    .trim();
}

/** Quita el candado de entrada y deja la dirección. */
export function ungateLocationReply(text: string): string {
  if (!replyGatesInfoOnEntrada(text)) {
    return text;
  }
  const kept = keepQuotedFacts(text);
  if (hasDealershipAddress(text) && kept) {
    return `${kept} ${text.match(/[^.?!]*av\.?\s*espa[nñ]a[^.?!]*[.?!]?/i)?.[0] ?? ''}`.trim();
  }
  if (hasDealershipAddress(text) && !kept) {
    return DEALERSHIP_ADDRESS;
  }
  return kept ? `${kept}\n\n${DEALERSHIP_ADDRESS}` : DEALERSHIP_ADDRESS;
}
