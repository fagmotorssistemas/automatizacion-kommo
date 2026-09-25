const HARD_FAREWELL =
  /\b(?:no me interesa|ya no(?:\s+me\s+interesa)?|ya compr[eé]|no me contacten|no lo contacten|chao|adi[oó]s|d[eé]jeme)\b/i;

const SOFT_NO =
  /(?:^|\b)(?:no gracias|gracias no|no por ahora|por ahora no|en este momento no)(?:\b|$)|^(?:no)[.!]?$/i;

const PAUSE_LATER =
  /\b(?:aun no|luego|mas tarde|seguimos en contacto|te aviso|otro (?:dia|momento))\b/i;

const GRACIAS = /\b(?:gracias|agradezco|muy amable)\b/i;

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Se va de verdad: no le interesa, ya compró, no lo contacten. */
export function isHardFarewell(text: string): boolean {
  return HARD_FAREWELL.test(fold(text));
}

/**
 * Un no corto a la pregunta de ahora.
 * No es despedida. “no gracias, ya no me interesa” gana como cierre duro.
 */
export function isSoftNo(text: string): boolean {
  const clean = text.trim();
  if (!clean || isHardFarewell(clean)) {
    return false;
  }
  return SOFT_NO.test(fold(clean));
}

/** Aún no / luego / seguimos en contacto. Sigue vivo, no ahora. */
export function isPauseLater(text: string): boolean {
  const n = fold(text);
  if (!n || isHardFarewell(n) || isSoftNo(text)) {
    return false;
  }
  return PAUSE_LATER.test(n);
}

/** El bot acaba de preguntar financiamiento y/o visita. */
export function lastAskIsFinancingOrVisit(text: string): boolean {
  const n = fold(text);
  if (!n) {
    return false;
  }
  const asksFin = /\b(?:financi|credito|opciones de pago)\b/.test(n);
  const asksVisit =
    /\b(?:visita|conocer(?:lo|la)?(?:\s+(?:en\s+persona|personalmente))?|venir a (?:ver|conocer)|coordinar)\b/.test(
      n,
    );
  const isQuestion =
    /\?/.test(text) ||
    /\b(?:le gustaria|desea|prefiere|quiere que|coordin)\b/.test(n);
  return isQuestion && (asksFin || asksVisit);
}

/** Un gracias después de ver un carro es cortesía, no el cierre de la venta. */
export function isPoliteThanks(text: string): boolean {
  const clean = text.trim();
  if (!clean || isHardFarewell(clean) || isSoftNo(clean)) {
    return false;
  }
  return GRACIAS.test(clean);
}

export const SEGUIR_VENTA = `EL CLIENTE AGRADECIÓ. NO ES DESPEDIDA.
No digas "quedamos a su disposición" ni "que tenga un excelente día" ni "cualquier consulta futura".
Sigue con el vehículo que ya se le mostró.
Si TODAVÍA no se le preguntó financiamiento o visita, haz ESA pregunta UNA vez.
Si el turno anterior YA preguntó financiamiento o visita, NO la repitas ni la parafrasees.`;

export const CONTESTA_DUDA = `EL CLIENTE DEJÓ UNA DUDA O MALENTENDIDO (está en el RESUMEN). NO ES DESPEDIDA.
Contesta ESA duda ahora. No cierres. No digas "quedamos atentos" ni "cualquier consulta futura" ni "cuando esté listo".
Si la duda es del km, del año o de si el carro cuadra: usa el km REAL del inventario y la línea "km vs año" (mínimo 15.000 km/año, tope 20.000). Si el uso interno pasa el tope, di DIRECTO que es un carro cuidado y en buen estado (puede traer a su mecánico). PROHIBIDO decir que el km es alto, "aunque", "a pesar de" o justificar el recorrido. Si es BAJO o ACORDE, dilo sin disculpas. Confirma ESA unidad y el precio. No solo repitas el km. Si el km aún no está cargado (0 en ficha), dilo así: no inventes 0 kilómetros.
No cambies el tema a solo financiamiento o visita hasta haber contestado la duda.`;

export const NO_REPETIR_CTA = `EL CLIENTE DIJO QUE NO A LA ÚLTIMA PREGUNTA (financiamiento o visita). NO ES DESPEDIDA.
No vuelvas a preguntar financiamiento ni visita. No parafrasees esa pregunta.
Acepta el no en una línea corta. Deja la puerta abierta por si más adelante quiere esa unidad u otra.
No insistas. No ofrezcas la misma disyuntiva.`;

export const PAUSA_SIGUE = `EL CLIENTE AÚN NO QUIERE VISITA NI MÁS INFO AHORA. NO ES DESPEDIDA.
Confirma que sigue el interés en ESA unidad. No cierres.
PROHIBIDO preguntar otra vez financiamiento o visita en este turno.`;

/**
 * Una sola lectura, en este orden:
 * 1) duda  2) despedida dura  3) no a la última oferta
 * 4) pausa  5) cortesía  6) nada
 */
export function salesFollowHint(input: {
  customerText: string;
  lastAssistant?: string;
  hasDoubt: boolean;
  isFarewell: boolean;
  isCourtesy: boolean;
}): string {
  if (input.hasDoubt) {
    return CONTESTA_DUDA;
  }
  if (input.isFarewell || isHardFarewell(input.customerText)) {
    return '';
  }
  const lastWasCta = lastAskIsFinancingOrVisit(input.lastAssistant ?? '');
  if (isSoftNo(input.customerText)) {
    return lastWasCta ? NO_REPETIR_CTA : '';
  }
  if (isPauseLater(input.customerText)) {
    return PAUSA_SIGUE;
  }
  const courtesy = input.isCourtesy || isPoliteThanks(input.customerText);
  if (!courtesy) {
    return '';
  }
  return lastWasCta ? NO_REPETIR_CTA : SEGUIR_VENTA;
}
