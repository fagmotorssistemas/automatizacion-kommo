export type ParsedResumen = {
  vehiculo: string | null;
  contexto: string | null;
  solicitudActual: string | null;
};

export function solicitudSinBanderas(resumen: string): string {
  return stripResumenFlags(parseResumen(resumen).solicitudActual ?? '').trim();
}

export function parseResumen(resumen: string): ParsedResumen {
  const texto = resumen || '';
  const vehiculoMatch = texto.match(/Vehículo:\s*(.+?)(?:\n|$)/i);
  const contextoMatch = texto.match(/Contexto:\s*(.+?)(?:\n\n|\nSOLICITUD|$)/is);
  const solicitudMatch = texto.match(/SOLICITUD ACTUAL:\s*(.+?)$/is);

  return {
    vehiculo: vehiculoMatch?.[1]?.trim() || null,
    contexto: contextoMatch?.[1]?.trim() || null,
    solicitudActual: solicitudMatch?.[1]?.trim() || null,
  };
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * El resumen ya interpretó el mensaje. Aquí se lee esa lectura,
 * no las palabras sueltas del cliente.
 */
export function resumenAsksForListedPrice(resumen: string): boolean {
  if (resumenIsPriceObjection(resumen) || resumenPideNegociar(resumen)) {
    return false;
  }
  const flag = resumen.match(/pide\s+precio:\s*(s[ií]|no)(?:\s|$)/i);
  if (flag) {
    return /^s/i.test(flag[1]);
  }
  const solicitud = parseResumen(resumen).solicitudActual ?? resumen;
  const n = fold(solicitud);
  if (/\bprecio\s+menor\b/.test(n) || /\bpresupuesto\b/.test(n)) {
    return false;
  }
  if (/\bprecio\b/.test(n)) {
    return true;
  }
  if (/\b(cuota|entrada|inicial|kilometr|\bkm\b)\b/.test(n)) {
    return false;
  }
  return /\bvalor(?:es)?\b/.test(n);
}

function flagSiNo(resumen: string, name: string): boolean | null {
  const match = resumen.match(
    new RegExp(`${name}:\\s*(s[ií]|no)(?:\\s|$)`, 'i'),
  );
  if (!match) {
    return null;
  }
  return /^s/i.test(match[1]);
}

function stripResumenFlags(text: string): string {
  return text
    .replace(/pide\s+(?:precio|cr[eé]dito|otro\s+color):\s*(s[ií]|no)/gi, '')
    .replace(/objeci[oó]n\s+de\s+precio:\s*(s[ií]|no)/gi, '')
    .replace(/tiene\s+duda:\s*(s[ií]|no)/gi, '')
    .replace(/es\s+despedida:\s*(s[ií]|no)/gi, '')
    .replace(/acepta\s+cr[eé]dito:\s*(s[ií]|no)/gi, '')
    .replace(/rechaza\s+aplicar:\s*(s[ií]|no)/gi, '')
    .replace(/prefiere\s+contado:\s*(s[ií]|no)/gi, '')
    .replace(/pide\s+negociar:\s*(s[ií]|no)/gi, '')
    .replace(/pide\s+otras:\s*(s[ií]|no)/gi, '')
    .replace(/caja\s+de\s+compra:\s*(autom[aá]tica|manual|no)/gi, '')
    .replace(/toma\s+ficha:\s*.+/gi, '')
    .replace(/toma\s+ya:\s*.+/gi, '')
    .replace(/toma\s+falta:\s*.+/gi, '')
    .replace(/toma\s+pendiente:\s*.+/gi, '')
    .replace(/toma:\s*(s[ií]|no|[^\n]+)/gi, '')
    .replace(/es\s+acuse:\s*(s[ií]|no)/gi, '')
    .replace(/es\s+cortes[ií]a:\s*(s[ií]|no)/gi, '');
}

/** Objeta el valor que ya vio; no está pidiendo oír el número. */
export function textIsPriceObjection(text: string): boolean {
  const n = fold(stripResumenFlags(text));
  if (
    /\b(?:cuanto|cual|cotiz|cotis|iel\s+valor|el\s+valor)\b/.test(n) &&
    !/\b(alto|cara?|mucho)\b/.test(n)
  ) {
    return false;
  }
  return (
    (/\bprecios?\b/.test(n) &&
      /\b(alto|cara?|mucho|descuent|rebaja|negociable)\b/.test(n)) ||
    /\b(?:muy\s+)?caro\b/.test(n)
  );
}

/** El cliente pide el valor de la unidad (precio / cotizar / “el valor”). */
export function textAsksForListedPrice(text: string): boolean {
  const n = fold(stripResumenFlags(text));
  if (/\bprecio\s+menor\b/.test(n) || /\bpresupuesto\b/.test(n)) {
    return false;
  }
  if (textIsPriceObjection(text)) {
    return false;
  }
  if (/\b(?:precios?|cotiz|cotis)/.test(n)) {
    return true;
  }
  return /\biel\s+valor\b|\bel\s+valor\b|\bvalores?\b/.test(n);
}

/**
 * Va a juntar más entrada después. No está pidiendo la cuota otra vez.
 * "2 mil de entrada" o "a 5 años" sí es un cálculo nuevo.
 */
export function postponesBiggerDownPayment(text: string): boolean {
  const n = fold(stripResumenFlags(text));
  if (/\b(?:cuanto|proforma|mensual(?:idad)?|cuota)\b/.test(n)) {
    return false;
  }
  if (/\b\d+\s*an[io]s\b/.test(n)) {
    return false;
  }
  if (/\d/.test(n) && /\bentrada\b/.test(n)) {
    return false;
  }
  return (
    /\b(?:buscar|juntar|conseguir|reunir|ahorrar)\b/.test(n) &&
    /\bentrada\b/.test(n)
  );
}

/** "Aaa", "buen", "ok": ya oyó lo anterior. No pide otro dato. */
export function isThreadAck(text: string): boolean {
  const n = fold(text)
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!n || n.length > 40) {
    return false;
  }
  return /^(?:a+|ah+|ok|okay|okey|vale|si|bueno|buen|dale|listo|ya|aja|claro)(?:\s+(?:a+|ah+|ok|okay|okey|vale|si|bueno|buen|dale|listo|ya|aja|claro))*$/.test(
    n,
  );
}

/** El bot ya dijo un monto de cuota en este hilo. */
export function historyAlreadyGaveCuota(
  history?: { role: string; content: string }[],
): boolean {
  return (history ?? []).some(
    (item) =>
      item.role === 'assistant' &&
      /\bcuota\b/i.test(item.content) &&
      /\$\s*\d/.test(item.content),
  );
}

/** El mensaje da o pide entrada, plazo o crédito. */
export function textAsksForCredit(text: string): boolean {
  if (postponesBiggerDownPayment(text)) {
    return false;
  }
  const n = fold(stripResumenFlags(text));
  return (
    /\b(credito|financiamiento|cuota|entrada|plazo|inicial|proforma|mensual(?:idad)?)\b/.test(
      n,
    ) ||
    /\b\d+\s*an[io]s\b/.test(n)
  );
}

/**
 * El analizador pidió fotos o video de la unidad.
 * Se lee la SOLICITUD, no las palabras sueltas del cliente.
 */
export function resumenAsksForPhotos(resumen: string): boolean {
  const solicitud = fold(
    stripResumenFlags(parseResumen(resumen).solicitudActual ?? ''),
  );
  if (!solicitud) {
    return false;
  }
  if (
    /\bno\s+(?:solicita|pide|quiere|envien|manden)\s+(?:fotos?|videos?)\b/.test(
      solicitud,
    )
  ) {
    return false;
  }
  return (
    /\b(?:solicita|pide)\s+(?:fotos?|videos?)\b/.test(solicitud) ||
    /\b(?:envien|enviar|manden|compartan)\s+(?:fotos?|videos?)\b/.test(
      solicitud,
    ) ||
    /\b(?:fotos?|videos?)\s+(?:o\s+(?:fotos?|videos?)\s+)?del\b/.test(solicitud)
  );
}

const LOCATION_ASK =
  /\b(?:ubicacion|direccion|parqueadero|ir a ver|donde estan|donde queda)\b/;

/** Quiere la dirección / ir a ver. No se condiciona a la entrada. */
export function textAsksForLocation(text: string): boolean {
  const n = fold(stripResumenFlags(text));
  if (LOCATION_ASK.test(n)) {
    return true;
  }
  return (
    /\b(?:entrada|plata|deposit|apostar)\b/.test(n) &&
    /\b(?:direccion|ubicacion|visita)\b/.test(n)
  );
}

/** El resumen nombra ubicación, dirección o visita. */
export function resumenAsksForLocation(resumen: string): boolean {
  const solicitud = fold(
    stripResumenFlags(parseResumen(resumen).solicitudActual ?? ''),
  );
  if (!solicitud) {
    return false;
  }
  return textAsksForLocation(solicitud);
}

/** El analizador vio que quiere crédito / financiamiento, no solo el precio de contado. */
export function resumenAsksForCredit(resumen: string): boolean {
  const solicitud = parseResumen(resumen).solicitudActual ?? resumen;
  if (textAsksForCredit(solicitud)) {
    return true;
  }
  const flag = flagSiNo(resumen, 'pide\\s+cr[eé]dito');
  if (flag != null) {
    return flag;
  }
  return false;
}

/** El analizador vio que quiere otro color del mismo modelo, no la misma unidad. */
export function resumenAsksForOtherColor(resumen: string): boolean {
  const flag = flagSiNo(resumen, 'pide\\s+otro\\s+color');
  if (flag != null) {
    return flag;
  }
  const solicitud = parseResumen(resumen).solicitudActual ?? '';
  return /otro(?:s)?\s+colore?s?|otra(?:s)?\s+colore?s?/.test(fold(solicitud));
}

/** El mensaje pide otro color de la misma línea. */
export function textAsksForOtherColor(text: string): boolean {
  return /otro(?:s)?\s+colore?s?|otra(?:s)?\s+colore?s?/.test(fold(text));
}

/** El analizador vio una duda o malentendido pendiente. No es cierre. */
export function resumenHasPendingDoubt(resumen: string): boolean {
  const flag = flagSiNo(resumen, 'tiene\\s+duda');
  if (flag != null) {
    return flag;
  }
  const solicitud = parseResumen(resumen).solicitudActual ?? '';
  return /\bduda\b|\bmalentendido\b|\bincognita\b/i.test(fold(solicitud));
}

/** El bot ya dijo un $ de inventario en el hilo. Hablar otra vez de precio no es pedir la ficha. */
export function historyHasListedPrice(
  history?: { role: string; content: string }[],
): boolean {
  return (history ?? []).some(
    (item) =>
      item.role === 'assistant' &&
      /\$\s*\d{1,3}(?:[.,]\d{3})+|\$\s*\d{3,6}\b/i.test(item.content),
  );
}

/** El analizador leyó que objeta el valor, no que pide oír el número. */
export function resumenIsPriceObjection(resumen: string): boolean {
  const flag = flagSiNo(resumen, 'objeci[oó]n\\s+de\\s+precio');
  if (flag != null) {
    return flag;
  }
  const solicitud = fold(
    stripResumenFlags(parseResumen(resumen).solicitudActual ?? ''),
  );
  if (!solicitud) {
    return false;
  }
  if (/\b(?:quiere|pide|solicita)\b/.test(solicitud) && /\b(?:precio|valor)\b/.test(solicitud)) {
    return false;
  }
  return /\b(alto|cara?|mucho|descuent|rebaja|negociable|no le alcanza)\b/.test(
    solicitud,
  );
}

/** Ya hubo cuota y AHORA acepta ver si aplica. Lo lee el resumen, no una lista. */
export function resumenAceptaCredito(resumen: string): boolean {
  return flagSiNo(resumen, 'acepta\\s+cr[eé]dito') === true;
}

/** Dijo que no quiere que veamos si aplica. */
export function resumenRechazaAplicar(resumen: string): boolean {
  return flagSiNo(resumen, 'rechaza\\s+aplicar') === true;
}

/** Después de ofrecer crédito o contado, se queda de contado. */
export function resumenPrefiereContado(resumen: string): boolean {
  return flagSiNo(resumen, 'prefiere\\s+contado') === true;
}

/** Pregunta si hay entrega inmediata, no el $. */
export function textAsksForImmediateDelivery(text: string): boolean {
  return /\bentrega inmediata\b/.test(fold(stripResumenFlags(text)));
}

export function resumenAsksForImmediateDelivery(resumen: string): boolean {
  const solicitud = fold(
    stripResumenFlags(parseResumen(resumen).solicitudActual ?? ''),
  );
  return /\bentrega inmediata\b/.test(solicitud);
}

/** Quiere descuento, rebaja o negociar (o ofrece un monto). No es pedir oír el $. */
export function resumenPideNegociar(resumen: string): boolean {
  return flagSiNo(resumen, 'pide\\s+negociar') === true;
}

/** Pidió otra unidad: es cambio de vehículo. Lo decide el resumen, no una frase del cliente. */
export function resumenPideOtras(resumen: string): boolean {
  return flagSiNo(resumen, 'pide\\s+otras') === true;
}

export type CajaCompra = 'manual' | 'automatica' | 'no';

/**
 * Caja del carro que quiere COMPRAR. Lo decide el analizador.
 * `no` = mencionó caja del suyo (toma) o no pidió caja para patio.
 */
export function resumenCajaCompra(resumen: string): CajaCompra | null {
  const match = resumen.match(
    /caja\s+de\s+compra:\s*(autom[aá]tica|manual|no)(?:\s|$)/i,
  );
  if (!match) {
    return null;
  }
  const value = fold(match[1]);
  if (value === 'no') {
    return 'no';
  }
  if (value.startsWith('manual')) {
    return 'manual';
  }
  return 'automatica';
}

function tomaFichaLine(resumen: string): string | null {
  const match = resumen.match(/toma\s+ficha:\s*(.+?)(?:\n|$)/i);
  if (!match) {
    return null;
  }
  const value = match[1].trim();
  if (!value || /^no$/i.test(value)) {
    return null;
  }
  return value;
}

/** El analizador leyó que habla del carro SUYO (toma), no de uno de patio. */
export function resumenEsToma(resumen: string): boolean {
  const flag = flagSiNo(resumen, 'toma');
  if (flag === true) {
    return true;
  }
  if (flag === false) {
    return false;
  }
  if (tomaFichaLine(resumen)) {
    return true;
  }
  return /vendernos su|quiere vender su/.test(
    fold(solicitudSinBanderas(resumen)),
  );
}

/**
 * Ficha del carro que nos vende/deja, según el analizador.
 * `null` = no hay toma o dijo Toma ficha: no.
 */
export function resumenTomaFicha(resumen: string): string | null {
  const explicit = tomaFichaLine(resumen);
  if (explicit) {
    return explicit;
  }
  if (!resumenEsToma(resumen)) {
    return null;
  }
  const solicitud = solicitudSinBanderas(resumen);
  const match = solicitud.match(
    /(?:vendernos su|quiere vender su)\s+(.+?)(?:\.|$)/i,
  );
  return match?.[1]?.trim() || null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Quita del texto los datos del carro de la toma que el analizador ya separó.
 * Sin ficha no se usa el mensaje actual como pedido de compra.
 */
export function stripTomaFacts(text: string, ficha: string | null): string {
  if (!ficha) {
    return '';
  }
  let out = text;
  const tokens = ficha.split(/[^\p{L}\p{N}]+/u).filter((token) => {
    if (/^(?:19|20)\d{2}$/.test(token)) {
      return true;
    }
    return token.length >= 3;
  });
  for (const token of tokens) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, 'gi'), ' ');
  }
  return out
    .replace(/\bautom[aá]tic[oa]s?\b/gi, ' ')
    .replace(/\b(?:manual(?:es)?|mec[aá]nic[oa]s?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ya entendió; no pide otra ficha ni cuota.
 * Bandera o SOLICITUD del analizador. La lista de “ok/aaa” queda de respaldo.
 */
export function resumenIsThreadAck(resumen: string): boolean {
  if (
    resumenIsFarewell(resumen) ||
    flagSiNo(resumen, 'pide\\s+precio') === true ||
    flagSiNo(resumen, 'pide\\s+cr[eé]dito') === true ||
    resumenAsksForPhotos(resumen) ||
    resumenAceptaCredito(resumen) ||
    resumenRechazaAplicar(resumen)
  ) {
    return false;
  }
  const flag = flagSiNo(resumen, 'es\\s+acuse');
  if (flag != null) {
    return flag;
  }
  const solicitud = fold(
    stripResumenFlags(parseResumen(resumen).solicitudActual ?? ''),
  );
  if (!solicitud) {
    return false;
  }
  return (
    /\bno quiere que le repitan\b/.test(solicitud) ||
    /\bya entendio\b/.test(solicitud) ||
    /\bno pide otra (?:proforma|cuota|ficha)\b/.test(solicitud)
  );
}

/**
 * Agradeció; no se va.
 * Bandera o SOLICITUD. “gracias” en el mensaje queda de respaldo.
 */
export function resumenIsCourtesy(resumen: string): boolean {
  if (resumenIsFarewell(resumen) || resumenHasPendingDoubt(resumen)) {
    return false;
  }
  const solicitud = fold(
    stripResumenFlags(parseResumen(resumen).solicitudActual ?? ''),
  );
  if (
    /\bno quiere (?:financi\w*|visita|mas info|la oferta)\b/.test(solicitud) ||
    (/\brechaz/.test(solicitud) && /\b(?:financi\w*|visita)\b/.test(solicitud))
  ) {
    return false;
  }
  const flag = flagSiNo(resumen, 'es\\s+cortes[ií]a');
  if (flag != null) {
    return flag;
  }
  return /\bagradece\b|\bcortesia\b/.test(solicitud);
}

/** El analizador marcó que de verdad se va, sin duda pendiente. */
export function resumenIsFarewell(resumen: string): boolean {
  if (resumenHasPendingDoubt(resumen)) {
    return false;
  }
  return flagSiNo(resumen, 'es\\s+despedida') === true;
}
