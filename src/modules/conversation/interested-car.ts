import {
  detectAskedCab,
  detectAskedDrive,
  modelFamily,
  normalizeModelText,
  textMentionsModel,
  unitCab,
  unitCaja,
  unitDoors,
  unitDrive,
} from '../catalog/clasificar-filas';
import { textoQueNombra } from './named-this-turn';
import { formatMileageFact } from '../catalog/mileage';
import { kindFromTypeBody } from './vehicle-kind';
import {
  colorMatches,
  detectBrand,
  detectColorInText,
  askedModelPhrase,
  detectNamedModelAsk,
  detectTrimInText,
  modelPhraseMatchesCar,
  detectYearInText,
  modelHasTrim,
} from './vehicle-brand';
import { detectGearbox, gearboxOf, stripGearboxWords } from './gearbox';
import { isLargePassengerCar, seatsOfCar } from './large-passenger';
import { emptyLexicon, type VehicleLexicon } from './fuzzy-vehicle-name';
import { fila1Nueva } from './otro-vehiculo';
import {
  resumenAsksAboutShownFacts,
  resumenAsksForCredit,
  resumenAsksForListedPrice,
  resumenAsientos,
  resumenCabina,
  resumenCajaCompra,
  resumenColorPedido,
  resumenHasPendingDoubt,
  resumenPideOtras,
  resumenPideOtroColor,
  resumenPidePresupuesto,
  resumenTipoPatio,
  resumenTopeContado,
  resumenTraccionPedida,
  resumenTresFilas,
} from '../intelligence/parse-resumen';
import { otrasDiferidas } from '../intelligence/sanitize-resumen-flags';
import { InterestedCarSnapshot } from '../persistence/lead.types';
import { sanitizePlateShort } from '../catalog/plate-short';
import { hasLoadedPrice } from './strip-unsolicited-price';

export type ShownCarContext = {
  text: string;
  resumen?: string | null;
  history?: { role: string; content: string }[];
  car: InterestedCarSnapshot | null;
  lexicon?: VehicleLexicon;
  /** Vehículo que el resumen ya tiene como pedido del cliente. */
  pedido?: string | null;
  lastAssistantText?: string | readonly string[];
  otroEsLaMostrada?: boolean | null;
  otroOverride?: string | null;
};

/** El nombre pedido (T1, Getours T1) es la misma línea que ya está en patio. */
export function askedMatchesShownModel(askedFamily: string, carModel: string): boolean {
  const family = normalizeModelText(askedFamily);
  if (!family) {
    return false;
  }
  const shown = modelFamily(carModel);
  if (family === shown) {
    return true;
  }
  const escaped = family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\b${escaped}\\b`, 'i').test(normalizeModelText(carModel))) {
    return true;
  }
  return (
    family.length >= 4 &&
    shown.length >= 4 &&
    (shown.includes(family) || family.includes(shown))
  );
}

/** Nombró otra marca, otra línea o otro año que la unidad ya mostrada. */
export function customerNamedAnotherShownCar(
  text: string,
  car: { brand: string; model: string; year?: number | null } | null,
  lexicon: VehicleLexicon = emptyLexicon(),
): boolean {
  if (!car || !text.trim()) {
    return false;
  }
  const brand = detectBrand(text, lexicon);
  if (brand && brand !== car.brand.trim().toLowerCase()) {
    return true;
  }
  const asked = detectNamedModelAsk(text, lexicon);
  if (asked?.family && !askedMatchesShownModel(asked.family, car.model)) {
    return true;
  }
  if (asked?.year && car.year && asked.year !== car.year) {
    return true;
  }
  return false;
}

/** Misma línea del hilo. Null = no nombró modelo (sigue en esa). Otro año sí es otra. */
export function sameShownUnitAsk(
  asked: { family: string; year?: number | null } | null,
  car: { model: string; year?: number | null },
): boolean {
  if (!asked) {
    return true;
  }
  if (!askedMatchesShownModel(asked.family, car.model)) {
    return false;
  }
  if (asked.year && car.year && asked.year !== car.year) {
    return false;
  }
  return true;
}

/** Otro año, versión o color: ya no es la unidad que mostramos. */
export function askedOtherUnitFacts(
  text: string,
  car: InterestedCarSnapshot,
): boolean {
  const year = detectYearInText(text);
  if (
    year &&
    car.year &&
    year !== car.year &&
    String(year) !== modelFamily(car.model)
  ) {
    return true;
  }
  const trim = detectTrimInText(text);
  if (trim && !modelHasTrim(car.model, trim)) {
    return true;
  }
  const color = detectColorInText(text);
  if (color && car.color && !colorMatches(car.color, color)) {
    return true;
  }
  return false;
}

/**
 * El vehículo del resumen cabe en esa unidad.
 * Color, caja y la versión que el resumen sí nombró tienen que coincidir.
 * No alcanza con que las dos sean de la misma familia.
 */
export function vehicleLabelFitsCar(
  label: string,
  car: { model: string; color?: string | null; transmission?: string | null },
  lexicon: VehicleLexicon = emptyLexicon(),
): boolean {
  const color = detectColorInText(label);
  const box = detectGearbox(label, lexicon);
  const phrase = stripGearboxWords(askedModelPhrase(label, lexicon));
  if (phrase && !modelPhraseMatchesCar(phrase, car.model)) {
    return false;
  }
  if (color && car.color && !colorMatches(car.color, color)) {
    return false;
  }
  const shownBox = gearboxOf(car);
  if (box && shownBox && box !== shownBox) {
    return false;
  }
  const family = modelFamily(phrase);
  const modelNorm = normalizeModelText(car.model);
  const extras = normalizeModelText(phrase)
    .split(/[^a-z0-9]+/)
    .filter(
      (token) =>
        token.length >= 2 &&
        token !== family &&
        !/^(?:tm|ta|cd|cs|4x2|4x4|5p|4p|3p|color|ano|caja|transmision|traccion|version|unidad|modelo)$/.test(token),
    );
  return extras.every((token) =>
    new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
      modelNorm,
    ),
  );
}

/** “No era 4x4?” pregunta por ESTA; no está pidiendo otra 4x4. */
function textAsksAboutShownDrive(text: string): boolean {
  return /no era\b|\bes\s*4\s*x|\btiene\s*4\s*x|tracci[oó]n|\bvs\s*4\s*x/i.test(
    text,
  );
}

/** “¿es automática?” pregunta por ESTA; “y en manual?” pide otra caja. */
function textAsksAboutShownGearbox(text: string): boolean {
  return /no era\b|\bes\s+(?:automatic|manual|mecanica)|\besta\s+es\s+(?:automatic|manual|mecanica)|\btiene\s+(?:caja\s+)?(?:automatic|manual|mecanica)/i.test(
    foldAsk(text),
  );
}

function lastAssistantFromContext(
  input: ShownCarContext,
): string | readonly string[] {
  if (input.lastAssistantText != null) {
    return input.lastAssistantText;
  }
  return (input.history ?? [])
    .filter((item) => item.role === 'assistant')
    .map((item) => item.content)
    .slice(-3);
}

export function shownLeavesByFila1(input: ShownCarContext): boolean {
  const car = input.car;
  if (!car) {
    return false;
  }
  return fila1Nueva({
    resumen: input.resumen ?? '',
    customerText: input.text,
    lastAssistantText: lastAssistantFromContext(input),
    car,
    otroEsLaMostrada: input.otroEsLaMostrada ?? null,
    otroOverride: input.otroOverride,
  }).suelta;
}

function shownRowBrand(car: { brand: string }): string {
  return normalizeModelText(car.brand);
}

/** El texto habla de ESTA fila (marca/modelo de la ficha). No usa el léxico. */
function refersToShownRow(
  text: string,
  car: { brand: string; model: string },
): boolean {
  if (!text.trim()) {
    return false;
  }
  if (textMentionsModel(text, car.model)) {
    return true;
  }
  const n = normalizeModelText(text);
  const brand = shownRowBrand(car);
  const family = modelFamily(car.model);
  if (!brand || !new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(n)) {
    return false;
  }
  const nums = n.match(/\b\d{3,4}[a-z]?\b/g) ?? [];
  return !nums.some((token) => {
    if (token === family) {
      return false;
    }
    if (/^(19|20)\d{2}$/.test(token) && token !== family) {
      return false;
    }
    return true;
  });
}

export function shownLeavesByColor(input: ShownCarContext): boolean {
  const resumen = input.resumen ?? '';
  if (resumenPideOtroColor(resumen)) {
    return true;
  }
  const car = input.car;
  const asked = resumenColorPedido(resumen);
  if (!car?.color || !asked) {
    return false;
  }
  const canonical = detectColorInText(asked) ?? asked;
  return !colorMatches(car.color, canonical);
}

export function shownLeavesByOtras(input: ShownCarContext): boolean {
  return (
    resumenPideOtras(input.resumen ?? '') && !otrasDiferidas(input.text)
  );
}

export function shownLeavesByTope(input: ShownCarContext): boolean {
  const car = input.car;
  if (!car) {
    return false;
  }
  const resumen = input.resumen ?? '';
  const budget = resumenTopeContado(resumen);
  return Boolean(
    resumenPidePresupuesto(resumen) &&
      budget &&
      (!car.price || budget < car.price),
  );
}

export function shownLeavesByCaja(input: ShownCarContext): boolean {
  const car = input.car;
  if (!car) {
    return false;
  }
  const caja = resumenCajaCompra(input.resumen ?? '');
  if (caja !== 'automatica' && caja !== 'manual') {
    return false;
  }
  const shownBox = gearboxOf(car);
  return Boolean(shownBox && caja !== shownBox);
}

export function shownLeavesByTipo(input: ShownCarContext): boolean {
  const car = input.car;
  if (!car) {
    return false;
  }
  const tipoPatio = resumenTipoPatio(input.resumen ?? '');
  if (!tipoPatio || tipoPatio === 'no') {
    return false;
  }
  const shownKind = kindFromTypeBody(car.typeBody);
  return Boolean(shownKind && tipoPatio !== shownKind);
}

export function shownLeavesByCabina(input: ShownCarContext): boolean {
  const car = input.car;
  if (!car) {
    return false;
  }
  const askedCab = resumenCabina(input.resumen ?? '');
  const shownCab = unitCab(car);
  return Boolean(askedCab && shownCab && askedCab !== shownCab);
}

export function shownLeavesByTraccion(input: ShownCarContext): boolean {
  const car = input.car;
  if (!car) {
    return false;
  }
  const askedDrive = resumenTraccionPedida(input.resumen ?? '');
  if (!askedDrive || askedDrive === 'no') {
    return false;
  }
  const shownDrive = unitDrive(car);
  return Boolean(shownDrive && askedDrive !== shownDrive);
}

export function shownLeavesByAsientos(input: ShownCarContext): boolean {
  const car = input.car;
  if (!car) {
    return false;
  }
  const resumen = input.resumen ?? '';
  const asientos = resumenAsientos(resumen);
  const tresFilas = resumenTresFilas(resumen);
  if (!tresFilas && asientos == null) {
    return false;
  }
  if (!isLargePassengerCar({ model: car.model, typeBody: car.typeBody })) {
    return true;
  }
  if (asientos == null) {
    return false;
  }
  const have = seatsOfCar(car.passengerCapacity);
  if (have != null && have < asientos) {
    return true;
  }
  return asientos >= 8 && (have == null || have < 7);
}

/** Bandera del resumen que disparó el cambio de carro. n/a si no aplica. */
export function stayLeaveBandera(
  input: ShownCarContext,
  motivo: string,
): string {
  const resumen = input.resumen ?? '';
  if (motivo === 'otro_color') {
    if (resumenPideOtroColor(resumen)) {
      return 'Pide otro color:sí';
    }
    const color = resumenColorPedido(resumen);
    return color ? `Color pedido:${color}` : 'n/a';
  }
  if (motivo === 'caja') {
    const caja = resumenCajaCompra(resumen);
    return caja && caja !== 'no' ? `Caja de compra:${caja}` : 'n/a';
  }
  if (motivo === 'tipo') {
    const tipo = resumenTipoPatio(resumen);
    return tipo && tipo !== 'no' ? `Tipo de patio:${tipo}` : 'n/a';
  }
  if (motivo === 'cabina') {
    const cab = resumenCabina(resumen);
    if (cab === 'cs') {
      return 'Cabina:simple';
    }
    if (cab === 'cd') {
      return 'Cabina:doble';
    }
    return 'n/a';
  }
  if (motivo === 'traccion') {
    const asked = resumenTraccionPedida(resumen);
    return asked && asked !== 'no' ? `Tracción pedida:${asked}` : 'n/a';
  }
  if (motivo === 'asientos') {
    if (resumenTresFilas(resumen)) {
      return 'Tres filas:sí';
    }
    const n = resumenAsientos(resumen);
    return n != null ? `Asientos:${n}` : 'n/a';
  }
  return 'n/a';
}

/** Dejó la unidad mostrada: otro carro, o el resumen decidió que pidió otra. */
export function leftShownCar(input: ShownCarContext): boolean {
  if (!input.car) {
    return false;
  }
  if (shownLeavesByColor(input)) {
    return true;
  }
  if (shownLeavesByOtras(input)) {
    return true;
  }
  if (shownLeavesByTope(input)) {
    return true;
  }
  if (shownLeavesByFila1(input)) {
    return true;
  }
  if (shownLeavesByCaja(input)) {
    return true;
  }
  if (shownLeavesByTipo(input)) {
    return true;
  }
  if (shownLeavesByCabina(input)) {
    return true;
  }
  if (shownLeavesByTraccion(input)) {
    return true;
  }
  if (shownLeavesByAsientos(input)) {
    return true;
  }
  return false;
}

/** El mensaje habla del último carro pedido, no de uno nuevo. */
export function refersToInterestedCar(
  text: string,
  car: InterestedCarSnapshot,
  lexicon?: VehicleLexicon,
  resumen?: string | null,
): boolean {
  return followsShownCar({ text, car, lexicon, resumen });
}

/**
 * El hilo sigue en la unidad que ya mostramos.
 * No depende de frases fijas: se mira el mensaje, el resumen y el último turno.
 * Solo se suelta si el cliente se fue a otro carro.
 */
export function followsShownCar(input: ShownCarContext): boolean {
  if (!input.car) {
    return false;
  }
  return !leftShownCar(input);
}

export { decideStayOnShown } from './otro-vehiculo';

export function listedPickStaysCore(
  input: ShownCarContext & { lastOfferText?: string },
  namedOther: boolean,
): boolean {
  const car = input.car;
  if (!car) {
    return false;
  }
  const lexicon = input.lexicon ?? emptyLexicon();
  const text = input.text;
  const resumen = input.resumen ?? '';
  const yearNow = detectYearInText(text);
  const colorNow = detectColorInText(text);
  const namedThis = textMentionsModel(
    textoQueNombra(resumen, text, lexicon),
    car.model,
  );
  if (namedOther && !namedThis) {
    return false;
  }
  if (
    yearNow != null &&
    car.year &&
    yearNow !== car.year &&
    String(yearNow) !== modelFamily(car.model)
  ) {
    return false;
  }
  if (colorNow && car.color && !colorMatches(car.color, colorNow)) {
    return false;
  }
  const box = detectGearbox(text, lexicon);
  const shownBox = gearboxOf(car);
  if (
    box &&
    shownBox &&
    box !== shownBox &&
    !textAsksAboutShownGearbox(text)
  ) {
    return false;
  }
  const askedCab = resumenCabina(resumen) ?? detectAskedCab(text);
  const shownCab = unitCab(car);
  if (askedCab && shownCab && askedCab !== shownCab) {
    return false;
  }
  const askedDrive = detectAskedDrive(`${text}\n${resumen}`);
  const shownDrive = unitDrive(car);
  if (
    askedDrive &&
    (shownDrive === '4x2' || shownDrive === '4x4') &&
    askedDrive !== shownDrive &&
    !resumenHasPendingDoubt(resumen) &&
    !textAsksAboutShownDrive(text)
  ) {
    return false;
  }
  const pointed =
    yearNow != null ||
    Boolean(colorNow) ||
    namedThis ||
    Boolean(box) ||
    Boolean(askedCab) ||
    Boolean(askedDrive) ||
    resumenAsksForListedPrice(resumen) ||
    resumenAsksForCredit(resumen) ||
    resumenAsksAboutShownFacts(resumen);
  if (!pointed) {
    return false;
  }
  if (
    input.lastOfferText &&
    !textMentionsModel(input.lastOfferText, car.model)
  ) {
    return false;
  }
  return true;
}

function foldAsk(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Ping de post-fotos: dice que envió, no trae la ficha. */
export function isFichaRecoveryPing(content: string): boolean {
  const n = foldAsk(content);
  const ping =
    /le (?:gusto|parecio)/.test(n) ||
    /hay algo que le detiene/.test(n) ||
    /le busque otra opcion/.test(n);
  const claimsSent = /le envie/.test(n);
  const hasCard =
    /tenemos disponible/.test(n) ||
    /transmision/.test(n) ||
    /aqu[ií] (?:tiene|tiene tambien) las fotos/.test(n) ||
    /color\s+\w+.{0,40}\d{3,6}\s*km/.test(n);
  return (ping || claimsSent) && !hasCard;
}

/** El bot ya mandó la ficha de ESA unidad (historial o resumen). */
export function historyPresentedFicha(
  history: { role: string; content: string }[] | undefined,
  model: string | undefined,
  resumen?: string | null,
): boolean {
  if (
    resumen &&
    /ficha (?:ya )?(?:enviada|mostrada)|fotos enviadas|fotos ya/i.test(
      resumen,
    )
  ) {
    return true;
  }
  if (!history?.length || !model) {
    return false;
  }
  return history.some((item) => {
    if (item.role !== 'assistant' || !textMentionsModel(item.content, model)) {
      return false;
    }
    if (isFichaRecoveryPing(item.content)) {
      return false;
    }
    return (
      /tenemos disponible|aqu[ií] (?:tiene(?: tambi[eé]n)? )?las fotos|fotos del veh[ií]culo/i.test(
        item.content,
      ) ||
      (/\b\d{3,6}\s*km\b/i.test(item.content) &&
        /color|transmisi[oó]n|autom[aá]tica|manual|4x[24]/i.test(item.content))
    );
  });
}

export function formatInterestedCar(
  car: InterestedCarSnapshot,
  includePrice = false,
  options?: {
    skipMileageCare?: boolean;
    slimAfterFicha?: boolean;
    replayFicha?: boolean;
    creditFollowUp?: boolean;
    afterFicha?: 'price' | 'location' | 'doubt' | 'both' | 'facts';
  },
): string {
  const year = car.year ? ` ${car.year}` : '';
  const shown =
    includePrice && car.price && car.price > 0
      ? `, $${Math.round(car.price)}`
      : '';
  const interno =
    !includePrice && car.price && car.price > 0
      ? `\nprecio_interno=${Math.round(car.price)} (solo para la herramienta de financiamiento. No lo escribas en respuesta_cliente.)`
      : '';
  if (options?.replayFicha) {
    const tipo = kindFromTypeBody(car.typeBody);
    const tipoLine = tipo
      ? `\nTipo de este carro: ${tipo}.`
      : '';
    const plate = sanitizePlateShort(car.plateShort);
    const caja = unitCaja(car);
    const puertas = unitDoors(car);
    const traccion = unitDrive(car);
    const facts = [
      car.mileage != null && Number.isFinite(car.mileage) && car.mileage > 0
        ? `km=${Math.round(car.mileage)}`
        : 'km=sin dato (aún no cargado. NO digas 0 km; el dato no está en patio)',
      car.color ? `color=${car.color}` : '',
      `caja=${caja ?? 'sin dato'}`,
      puertas != null ? `puertas=${puertas}` : '',
      `tracción=${traccion ?? 'sin dato'}`,
      plate ? `plate_short=${plate}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return `VEHÍCULO DE INTERÉS (pidió de nuevo la información)
${car.brand} ${car.model}${year}${shown}
inventory_id=${car.inventoryId}${interno}${tipoLine}
${facts}
PIDIÓ DE NUEVO LA FICHA de ESA unidad. Vuelve a darla completa (año, color, km, caja, tracción). Tono de asesor que retoma el hilo: claro, cercano, vendedor. PROHIBIDO “tenemos disponible”, “estimado”, abrir como si fuera el primer contacto. PROHIBIDO responder solo con km y mecánico. PROHIBIDO precio salvo que el resumen lo pida. Placa solo si preguntó o la ficha trae plate_short.`;
  }
  if (options?.slimAfterFicha) {
    const after = options?.afterFicha;
    const km =
      car.mileage != null && Number.isFinite(car.mileage) && car.mileage > 0
        ? `\nkm=${Math.round(car.mileage)} (para contestar el km o justificar, no para repetir la ficha)`
        : after === 'facts'
          ? '\nkm=sin dato. km=aún no cargado (NO digas 0 km; si pregunta el kilometraje, dilo: todavía no está en patio)'
          : '';
    const priceNote = hasLoadedPrice(car.price)
      ? ''
      : '\nprecio=aún no cargado (NO digas $0 ni $00; el dato no está en patio)';
    const close = options?.creditFollowUp
      ? 'YA vio esta unidad y el precio. Sigue ESA. Eligió el camino de financiamiento. PROHIBIDO repetir ficha, el $ ni “excelente estado / papeles / entrega”. Pregunta con cuánto de entrada y a qué plazo. No inventes cuota sin esos datos.'
      : after === 'location'
      ? 'YA vio esta unidad. Contesta AHORA dónde verla (Av. España 6-73 y Sevilla, Cuenca). PROHIBIDO repetir ficha, “tenemos disponible”, km, placa o fotos. No menciones entrada ni depósito.'
      : after === 'doubt'
      ? 'YA vio esta unidad. Contesta la duda de ESA. PROHIBIDO repetir ficha, “tenemos disponible” o fotos.'
      : after === 'both'
      ? 'YA vio esta unidad. Di el $ de inventario y, en la misma respuesta, dónde verla (Av. España 6-73 y Sevilla, Cuenca). PROHIBIDO repetir ficha, “tenemos disponible” o fotos.'
      : after === 'facts'
      ? 'YA vio esta unidad. Contesta AHORA lo que pregunta (fotos, km, un detalle). PROHIBIDO volver a presentarla: no “tenemos disponible”, no ficha completa (color, caja, tracción, placa). Si pregunta el km y no está cargado, dilo así. No prometas fotos que no se van a enviar.'
      : hasLoadedPrice(car.price)
      ? 'YA vio esta unidad. Di el $ de inventario y justifica el valor (estado, km, garantía en documentos/traspaso). PROHIBIDO repetir color, caja, tracción, “tenemos disponible” o fotos. No inventes garantía mecánica.'
      : 'YA vio esta unidad. El precio AÚN NO ESTÁ CARGADO. Dilo así. PROHIBIDO $0 ni $00. No inventes un valor. PROHIBIDO repetir color, caja, tracción, “tenemos disponible” o fotos.';
    return `VEHÍCULO DE INTERÉS (la ficha YA se presentó en el hilo)
${car.brand} ${car.model}${year}${shown}
inventory_id=${car.inventoryId}${interno}${km}${priceNote}
${close}`;
  }
  const tipo = kindFromTypeBody(car.typeBody);
  const tipoLine = tipo
    ? `\nTipo de este carro: ${tipo}. Sigue con este tipo salvo que nombre un modelo de otro tipo.`
    : '';
  const plate = sanitizePlateShort(car.plateShort);
  const caja = unitCaja(car);
  const puertas = unitDoors(car);
  const traccion = unitDrive(car);
  const mileageFact =
    car.mileage != null && Number.isFinite(car.mileage) && car.mileage > 0
      ? formatMileageFact(car.mileage, car.year, new Date().getFullYear(), {
          skipClientCare: options?.skipMileageCare === true,
        })
      : 'km=sin dato (aún no cargado. NO digas 0 km; el dato no está en patio)';
  const facts = [
    mileageFact,
    car.color ? `color=${car.color}` : '',
    `caja=${caja ?? 'sin dato'}`,
    puertas != null ? `puertas=${puertas}` : '',
    `tracción=${traccion ?? 'sin dato'}`,
    plate ? `plate_short=${plate}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const priceUnload = hasLoadedPrice(car.price)
    ? ''
    : '\nprecio=aún no cargado (NO digas $0 ni $00; el dato no está en patio)';
  const factsLine = facts
    ? `\n${facts}
Estos datos van etiquetados. caja = transmisión (solo manual/automática; si es sin dato, no la menciones). 4p/5p = puertas, no transmisión. 4x2/4x4 = tracción, no transmisión. Placa: solo plate_short (nunca inventes una placa; el km no es placa).`
    : '';
  return `VEHÍCULO DE INTERÉS (interested_cars, el último que pidió)
${car.brand} ${car.model}${year}${shown}
inventory_id=${car.inventoryId}${interno}${priceUnload}${tipoLine}${factsLine}
Si no cambió de carro, sigue ESTA. No busques otra unidad.`;
}
