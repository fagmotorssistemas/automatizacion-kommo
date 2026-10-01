import { parseVehicleKind, type VehicleKind } from '../conversation/vehicle-kind';
import type { CabCode } from '../catalog/clasificar-filas';

export type ParsedResumen = {
  vehiculo: string | null;
  contexto: string | null;
  solicitudActual: string | null;
};

export function solicitudSinBanderas(resumen: string): string {
  return stripResumenFlags(parseResumen(resumen).solicitudActual ?? '').trim();
}

/** El vehículo que el cliente pidió. "No aplica" no cuenta. */
export function vehicleClientePidio(
  resumen: string | null | undefined,
): string | null {
  if (!resumen) {
    return null;
  }
  const raw = parseResumen(resumen).vehiculo?.trim() ?? '';
  if (!raw || /^(?:no aplica|no|s[ií])$/i.test(raw)) {
    return null;
  }
  return raw;
}

/**
 * Vehículo vigente: el de este turno, o el anterior si este no lo soltó
 * a propósito (pidió otras y puso No aplica).
 */
export function vehicleQueSigue(
  current: string,
  previous: string | null,
): string | null {
  const curVehicle = vehicleClientePidio(current);
  if (curVehicle) {
    return curVehicle;
  }
  const namedNoAplica = /^no aplica$/i.test(
    parseResumen(current).vehiculo?.trim() ?? '',
  );
  if (namedNoAplica && resumenPideOtras(current)) {
    return null;
  }
  return vehicleClientePidio(previous);
}

/**
 * Lo que el siguiente turno debe leer. Si este resumen soltó el vehículo
 * sin pedir otro, se queda el que el cliente ya había pedido.
 */
export function mergeResumenForNext(
  current: string,
  previous: string | null,
): string | null {
  const vehiculo = vehicleQueSigue(current, previous);
  const cur = parseResumen(current);
  const prev = parseResumen(previous ?? '');
  const contexto = (cur.contexto || prev.contexto || '').trim();
  const solicitud = (
    solicitudSinBanderas(current) || solicitudSinBanderas(previous ?? '')
  ).trim();
  if (!vehiculo && !solicitud && !contexto) {
    return null;
  }
  const lines = [`Vehículo: ${vehiculo || 'No aplica'}`];
  if (contexto) {
    lines.push(`Contexto: ${contexto}`);
  }
  if (solicitud) {
    lines.push(`SOLICITUD: ${solicitud}`);
  }
  return lines.join('\n').slice(0, 800);
}

/**
 * Lo que el analizador puede ver del turno anterior: Vehículo, Contexto y
 * la frase de SOLICITUD. Sin líneas de banderas. No es lo que se guarda
 * en Redis (eso sigue siendo mergeResumenForNext).
 */
export function previousResumenForLlm(
  raw: string | null | undefined,
): string {
  if (!raw?.trim()) {
    return '';
  }
  const text = raw.trim();
  const vehiculo =
    text.match(/(?:^|\n)\s*Veh[ií]culo:\s*(.+?)(?:\n|$)/i)?.[1]?.trim() ?? '';
  const contexto =
    text.match(/(?:^|\n)\s*Contexto:\s*(.+?)(?:\n|$)/i)?.[1]?.trim() ?? '';
  let solicitud = solicitudSinBanderas(text);
  if (!solicitud) {
    const match = text.match(
      /(?:^|\n)\s*SOLICITUD(?:\s+ACTUAL)?:\s*(.+?)(?=\n(?:Pide |Objeci|Acepta |Rechaza |Prefiere |Otro veh[ií]culo:|Quiere comprar:|Su carro:|Caja de |Cabina:|Tracci|Color pedido:|Tope |Falta |Tipo de |Asientos:|Tres filas:|Toma |Tiene duda:|Es )|$)/is,
    );
    solicitud = stripResumenFlags(match?.[1] ?? '').trim();
  }
  const lines: string[] = [];
  if (vehiculo) {
    lines.push(`Vehículo: ${vehiculo}`);
  }
  if (contexto) {
    lines.push(`Contexto: ${contexto}`);
  }
  if (solicitud) {
    lines.push(`SOLICITUD: ${solicitud}`);
  }
  return lines.join('\n');
}

export function parseResumen(resumen: string): ParsedResumen {
  const texto = resumen || '';
  const vehiculoMatch = texto.match(/(?:^|\n)\s*Vehículo:\s*(.+?)(?:\n|$)/i);
  const contextoMatch = texto.match(/Contexto:\s*(.+?)(?:\n\n|\nSOLICITUD|$)/is);
  const solicitudMatch = texto.match(/SOLICITUD ACTUAL:\s*(.+?)$/is);

  return {
    vehiculo: vehiculoMatch?.[1]?.trim() || null,
    contexto: contextoMatch?.[1]?.trim() || null,
    solicitudActual: stripIsolatedResumenLines(solicitudMatch?.[1]?.trim() || '') || null,
  };
}

/** Corta el “| no” del formato. No parte los bloques “A || B”. */
export function cutFlagValue(raw: string): string {
  const parts = raw.split(/(?<!\|)\|(?!\|)/);
  return (parts[0] ?? '').trim();
}

function resumenLineaVehiculo(resumen: string, name: string): string | null {
  const match = resumen.match(
    new RegExp(`(?:^|\\n)\\s*${name}:\\s*(.+?)(?:\\n|$)`, 'i'),
  );
  if (!match) {
    return null;
  }
  const raw = cutFlagValue(match[1]);
  if (!raw || /^no$/i.test(raw)) {
    return null;
  }
  return raw;
}

/** Lee "Otro vehículo: X" del resumen crudo. null si falta, está vacío o es "no". */
export function resumenOtroVehiculo(resumen: string): string | null {
  return resumenLineaVehiculo(resumen, 'otro\\s+veh[ií]culo');
}

/** Patio que pide ver/cotizar/comprar. Corta en el primer "|". */
export function resumenQuiereComprar(resumen: string): string | null {
  return resumenLineaVehiculo(resumen, 'quiere\\s+comprar');
}

/** Carro que ES DEL CLIENTE (toma / parte de pago). Corta en el primer "|". */
export function resumenSuCarro(resumen: string): string | null {
  return resumenLineaVehiculo(resumen, 'su\\s+carro');
}

function stripIsolatedResumenLines(text: string): string {
  return text
    .replace(/(?:^|\n)\s*otro\s+veh[ií]culo:\s*.*/gi, '')
    .replace(/(?:^|\n)\s*quiere\s+comprar:\s*.*/gi, '')
    .replace(/(?:^|\n)\s*su\s+carro:\s*.*/gi, '')
    .replace(/(?:^|\n)\s*tracci[oó]n\s+pedida:\s*.*/gi, '')
    .replace(/(?:^|\n)\s*color\s+pedido:\s*.*/gi, '')
    .trim();
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** La SOLICITUD pide oír el $; no objeta ni confirma un valor ya dicho. */
function solicitudPideElValor(resumen: string): boolean {
  const raw = parseResumen(resumen).solicitudActual || resumen;
  const solicitud = fold(stripResumenFlags(raw));
  if (!solicitud) {
    return false;
  }
  if (
    /\bprecio\s+menor\b/.test(solicitud) ||
    /\bpresupuesto\b/.test(solicitud) ||
    /\bobjeta\b/.test(solicitud) ||
    /\bvalor ya dicho\b/.test(solicitud) ||
    /\bya\s+(?:dijo|dicho|informo|confirmo)\b/.test(solicitud)
  ) {
    return false;
  }
  return (
    /\b(?:quiere|pide|solicita|confirme|confirmar)\b/.test(solicitud) &&
    /\b(?:precio|valor)\b/.test(solicitud)
  );
}

/**
 * El resumen ya interpretó el mensaje. Aquí se lee esa bandera,
 * no las palabras sueltas del cliente.
 * Si la bandera dice no pero la SOLICITUD pide el valor, gana la solicitud:
 * el analizador a veces marca primera presentación y deja el pedido de $ afuera.
 */
export function resumenAsksForListedPrice(resumen: string): boolean {
  if (resumenIsPriceObjection(resumen) || resumenPideNegociar(resumen)) {
    return false;
  }
  if (solicitudPideElValor(resumen)) {
    return true;
  }
  return flagSiNo(resumen, 'pide\\s+precio') === true;
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
    .replace(/pide\s+asesor:\s*(s[ií]|no)/gi, '')
    .replace(/acepta\s+cr[eé]dito:\s*(s[ií]|no)/gi, '')
    .replace(/rechaza\s+aplicar:\s*(s[ií]|no)/gi, '')
    .replace(/prefiere\s+contado:\s*(s[ií]|no)/gi, '')
    .replace(/pide\s+negociar:\s*(s[ií]|no)/gi, '')
    .replace(/pide\s+otras:\s*(s[ií]|no)/gi, '')
    .replace(/otro\s+veh[ií]culo:\s*[^\n]*/gi, '')
    .replace(/quiere\s+comprar:\s*[^\n]*/gi, '')
    .replace(/su\s+carro:\s*[^\n]*/gi, '')
    .replace(/pide\s+ficha:\s*(s[ií]|no)/gi, '')
    .replace(/caja\s+de\s+compra:\s*(autom[aá]tica|manual|no)/gi, '')
    .replace(/cabina:\s*(simple|doble|no)/gi, '')
    .replace(/tracci[oó]n\s+pedida:\s*[^\n]*/gi, '')
    .replace(/color\s+pedido:\s*[^\n]*/gi, '')
    .replace(/tope\s+de\s+contado:\s*[^\n]+/gi, '')
    .replace(/falta\s+veh[ií]culo:\s*(s[ií]|no)/gi, '')
    .replace(/tipo\s+de\s+patio:\s*[^\n]+/gi, '')
    .replace(/pide\s+horario:\s*(s[ií]|no)/gi, '')
    .replace(/pide\s+ubicaci[oó]n:\s*(s[ií]|no)/gi, '')
    .replace(/asientos:\s*[^\n]+/gi, '')
    .replace(/tres\s+filas:\s*(s[ií]|no)/gi, '')
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
    /\b(credito|financiamiento|cuota|entrada|plazo|inicial|proforma|mensual(?:idad)?|letras?)\b/.test(
      n,
    ) ||
    /\b\d+\s*(?:an[io]s|meses)\b/.test(n)
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

/** El analizador: quiere la ficha / los datos de ESA unidad. Lo decide por sentido. */
export function resumenPideFicha(resumen: string): boolean {
  return flagSiNo(resumen, 'pide\\s+ficha') === true;
}

/** El resumen marca si pidió verla / la dirección. Sin bandera no es ubicación. */
export function resumenAsksForLocation(resumen: string): boolean {
  return flagSiNo(resumen, 'pide\\s+ubicaci[oó]n') === true;
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

/** Bandera Pide otro color: sí. Sin fallback a la prosa. */
export function resumenPideOtroColor(resumen: string): boolean {
  return flagSiNo(resumen, 'pide\\s+otro\\s+color') === true;
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

/** El resumen dijo que sigue con la mostrada. No reinterpretes el texto del cliente. */
export function resumenStaysOnShownUnit(resumen: string): boolean {
  return flagSiNo(resumen, 'pide\\s+otras') === false;
}

/** El analizador: pide info/precio/ver y no hay carro. Lo decide por sentido. */
export function resumenFaltaVehiculo(resumen: string): boolean {
  return flagSiNo(resumen, 'falta\\s+veh[ií]culo') === true;
}

/** Pregunta si atienden / el horario de un día. Lo decide el resumen. */
export function resumenPideHorario(resumen: string): boolean {
  return flagSiNo(resumen, 'pide\\s+horario') === true;
}

/** Plazas que pide AHORA. Lo decide el analizador, no una palabra del cliente. */
export function resumenAsientos(resumen: string): number | null {
  const match = resumen.match(/asientos:\s*(.+?)(?:\n|$)/i);
  if (!match) {
    return null;
  }
  const raw = match[1].trim();
  if (!raw || /^no$/i.test(raw)) {
    return null;
  }
  const n = Number(raw.replace(/[^\d]/g, ''));
  if (!Number.isFinite(n) || n < 4 || n > 30) {
    return null;
  }
  return n;
}

/** Pidió 3 filas. No es Asientos: 7 ni un filtro de passenger_capacity. */
export function resumenTresFilas(resumen: string): boolean {
  return flagSiNo(resumen, 'tres\\s+filas') === true;
}

/**
 * Tipo de carro de patio que quiere AHORA. Lo decide el analizador.
 * `no` = este turno nombra marca/modelo/color y no sigue el tipo anterior.
 */
export function resumenTipoPatio(
  resumen: string,
): VehicleKind | 'no' | null {
  const match = resumen.match(
    /tipo\s+de\s+patio:\s*(suv|camioneta|sed[aá]n|hatchback|jeep|no)(?:\s|$)/i,
  );
  if (!match) {
    return null;
  }
  const value = fold(match[1]);
  if (value === 'no') {
    return 'no';
  }
  if (value === 'jeep') {
    return 'suv';
  }
  return parseVehicleKind(value);
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

/**
 * Cabina del carro que quiere COMPRAR. Lo decide el analizador.
 * `null` = no la pidió o dijo Cabina: no. El patio filtra por cs/cd.
 */
export function resumenCabina(resumen: string): CabCode | null {
  const match = resumen.match(/cabina:\s*(simple|doble|no)(?:\s|$)/i);
  if (!match) {
    return null;
  }
  const value = fold(match[1]);
  if (value === 'no') {
    return null;
  }
  return value === 'simple' ? 'cs' : 'cd';
}

export type TraccionPedida = '4x2' | '4x4' | 'no';

/**
 * Tracción del carro que quiere COMPRAR. Lo decide el analizador.
 * `no` = preguntó por la mostrada, es del suyo (toma) o no pidió tracción.
 */
export function resumenTraccionPedida(
  resumen: string,
): '4x2' | '4x4' | 'no' | null {
  const match = resumen.match(
    /tracci[oó]n\s+pedida:\s*(4\s*x\s*[24]|no)(?:\s|$)/i,
  );
  if (!match) {
    return null;
  }
  const value = fold(match[1]).replace(/\s+/g, '');
  if (value === 'no') {
    return 'no';
  }
  if (value === '4x2' || value === '4x4') {
    return value;
  }
  return null;
}

/**
 * Color concreto que quiere COMPRAR. Lo decide el analizador.
 * `null` = Color pedido: no, o la línea no está.
 */
export function resumenColorPedido(resumen: string): string | null {
  const match = resumen.match(/color\s+pedido:\s*(.+?)(?:\n|$)/i);
  if (!match) {
    return null;
  }
  const raw = cutFlagValue(match[1]);
  if (!raw || /^no$/i.test(raw)) {
    return null;
  }
  return fold(raw);
}

/** El analizador leyó un tope de contado. El número, no una frase del cliente. */
export function parseTopeAmount(text: string): number | null {
  const n = fold(text);
  if (!n || /^no$/.test(n.trim())) {
    return null;
  }
  const mil = n.match(/\$?\s*(\d{1,3}(?:[.,]\d{3})*|\d+)\s*mil\b/);
  if (mil) {
    const raw = mil[1].replace(/[.,]/g, '');
    const value = Number(raw);
    return Number.isFinite(value) ? value * (raw.length <= 3 ? 1000 : 1) : null;
  }
  const thousands = n.match(/(\d{1,3})[.,](\d{3})\b/);
  if (thousands) {
    const value = Number(`${thousands[1]}${thousands[2]}`);
    return Number.isFinite(value) && value >= 1000 ? value : null;
  }
  const plain = n.match(/(\d{4,6})/);
  if (!plain) {
    return null;
  }
  const value = Number(plain[1]);
  if (!Number.isFinite(value) || value < 3000) {
    return null;
  }
  if (value >= 1990 && value <= 2035) {
    return null;
  }
  return value;
}

export function resumenTopeContado(resumen: string): number | null {
  const match = resumen.match(/tope\s+de\s+contado:\s*(.+?)(?:\n|$)/i);
  if (!match) {
    return null;
  }
  return parseTopeAmount(match[1]);
}

/** Este turno pide un dato de la unidad ya mostrada. No usa Pide otras: no. */
export function resumenAsksAboutShownFacts(resumen: string): boolean {
  return (
    resumenPideNegociar(resumen) ||
    resumenIsPriceObjection(resumen) ||
    resumenAsksForLocation(resumen) ||
    resumenPideHorario(resumen) ||
    resumenAsksForListedPrice(resumen) ||
    resumenAsksForCredit(resumen) ||
    resumenAsksForPhotos(resumen) ||
    resumenPideFicha(resumen) ||
    resumenHasPendingDoubt(resumen) ||
    resumenIsCourtesy(resumen) ||
    resumenIsThreadAck(resumen) ||
    resumenPrefiereContado(resumen) ||
    resumenAceptaCredito(resumen)
  );
}

/** Sigue en la unidad mostrada: no es ver qué cabe en un tope. */
export function resumenSigueEnUnidadMostrada(resumen: string): boolean {
  if (resumenPideOtras(resumen)) {
    return false;
  }
  if (resumenStaysOnShownUnit(resumen)) {
    return true;
  }
  return resumenAsksAboutShownFacts(resumen);
}

function solicitudPideVerTope(resumen: string): boolean {
  const s = fold(solicitudSinBanderas(resumen) || '');
  if (!s) {
    return false;
  }
  return (
    /que cabe/.test(s) ||
    /que hay por/.test(s) ||
    /en ese tope/.test(s) ||
    /presupuesto/.test(s) ||
    /no (?:supere|pase|exceda)/.test(s) ||
    /dispone de/.test(s) ||
    /(?:tengo|tiene|hasta|unos)\s+\d/.test(s)
  );
}

/**
 * ESTE turno pide ver qué cabe en un tope. Un monto copiado mientras
 * preguntan precio, km o ubicación no cuenta: la solicitud no pide el tope.
 */
export function resumenPidePresupuesto(resumen: string): boolean {
  if (!resumenTopeContado(resumen)) {
    return false;
  }
  return solicitudPideVerTope(resumen);
}

function tomaFichaLine(resumen: string): string | null {
  const match = resumen.match(/toma\s+ficha:\s*(.+?)(?:\n|$)/i);
  if (!match) {
    return null;
  }
  const value = cutFlagValue(match[1]);
  if (!value || /^no$/i.test(value)) {
    return null;
  }
  return value;
}

/** El analizador leyó que habla del carro SUYO (toma), no de uno de patio. */
export function resumenEsToma(resumen: string): boolean {
  if (resumenSuCarro(resumen)) {
    return true;
  }
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
    resumenPideFicha(resumen) ||
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

/** El cliente pide una persona (asesor, que lo llamen, hablar con alguien). */
export function textPideAsesor(text: string): boolean {
  const n = fold(text);
  return (
    /\basesor\b/.test(n) ||
    /\bll[aá]menme\b/.test(n) ||
    /\bhumano\b/.test(n) ||
    /\bvendedor\b/.test(n) ||
    /\bconversarlo con una persona\b/.test(n) ||
    /\bhablar con (?:un |una )?(?:asesor|persona|alguien|humano|vendedor)\b/.test(
      n,
    )
  );
}

/** Bandera más evidencia en el mensaje del cliente. */
export function resumenPideAsesor(resumen: string, customerText = ''): boolean {
  if (flagSiNo(resumen, 'pide\\s+asesor') !== true) {
    return false;
  }
  return !customerText || textPideAsesor(customerText);
}
