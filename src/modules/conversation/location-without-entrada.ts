export const DEALERSHIP_ADDRESS =
  'Estamos en Av. España 6-73 y Sevilla, Cuenca. Puede venir a ver el vehículo cuando guste.';

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

export function hasDealershipAddress(text: string): boolean {
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

/** “No hace falta depósito para la dirección” no se le dice al cliente. */
function isDepositDisclaimer(sentence: string): boolean {
  const n = fold(sentence);
  const aboutPlace = /\b(direccion|ubicacion|visita|visitar)\b/.test(n);
  const aboutPay = /\b(deposit\w*|entrada)\b/.test(n);
  const denies =
    /\b(no es necesario|no hace falta|no se necesita|no requiere|sin necesidad|no tiene que|no debe|no condicion)\b/.test(
      n,
    );
  return aboutPlace && aboutPay && denies;
}

function withoutDepositDisclaimer(sentence: string): string {
  if (!isDepositDisclaimer(sentence)) {
    return sentence;
  }
  const cut = sentence
    .split(
      /\s*(?:;|,)?\s*(?=no es necesario|no hace falta|no se necesita|no requiere|sin necesidad|no tiene que|no debe)/i,
    )[0]
    .replace(/[;,]\s*$/, '')
    .trim();
  return hasDealershipAddress(cut) ? cut : '';
}

export function stripDepositDisclaimer(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(withoutDepositDisclaimer)
    .filter(Boolean)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Quita el candado de entrada y deja la dirección, sin la frase del depósito. */
export function ungateLocationReply(text: string): string {
  if (!replyGatesInfoOnEntrada(text)) {
    return stripDepositDisclaimer(text);
  }
  const kept = keepQuotedFacts(text);
  if (hasDealershipAddress(text) && kept) {
    const address =
      text.match(/[^.?!]*av\.?\s*espa[nñ]a[^.?!]*[.?!]?/i)?.[0] ?? '';
    return stripDepositDisclaimer(`${kept} ${address}`.trim());
  }
  if (hasDealershipAddress(text) && !kept) {
    return stripDepositDisclaimer(
      text.match(/[^.?!]*av\.?\s*espa[nñ]a[^.?!]*[.?!]?/i)?.[0]?.trim() ||
        DEALERSHIP_ADDRESS,
    );
  }
  return stripDepositDisclaimer(
    kept ? `${kept}\n\n${DEALERSHIP_ADDRESS}` : DEALERSHIP_ADDRESS,
  );
}

/** Mapa de Fag Motors / K-SI Nuevos (Av. España 6-73 y Sevilla, Cuenca). */
export const MAP_URL =
  'https://maps.app.goo.gl/vxJe7vw4cxNMQXtq8';

/**
 * Donde va la dirección va el mapa. Lo pega el sistema, no el modelo: así sale
 * siempre y nunca es un link inventado. Sin dirección en el texto no toca nada.
 */
export function appendMapLink(text: string): string {
  if (!hasDealershipAddress(text) || text.includes(MAP_URL)) {
    return text;
  }
  const map = `Aquí la ubicación en el mapa: ${MAP_URL}`;
  const body = text.trimEnd();
  // Si el mensaje cierra con una pregunta que viene DESPUÉS de la dirección,
  // el mapa va antes de esa pregunta: la pregunta siempre queda al final.
  const addressAt = body.search(/av\.?\s*espa[nñ]a/i);
  const questionAt = body.lastIndexOf('¿');
  if (
    body.endsWith('?') &&
    questionAt > addressAt &&
    addressAt >= 0 &&
    questionAt > 0
  ) {
    return `${body.slice(0, questionAt).trimEnd()}\n\n${map}\n\n${body.slice(questionAt)}`;
  }
  return `${body}\n\n${map}`;
}
