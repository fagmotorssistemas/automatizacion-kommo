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
import { detectVehicleKind, kindFromTypeBody } from './vehicle-kind';
import {
  colorMatches,
  detectBrand,
  detectColorInText,
  askedModelPhrase,
  detectNamedModelAsk,
  detectTrimInText,
  modelPhraseMatchesCar,
  detectYearInText,
  isDriveFamily,
  modelHasTrim,
} from './vehicle-brand';
import { detectGearbox, gearboxOf, stripGearboxWords } from './gearbox';
import {
  asksForLargePassengerSpace,
  isLargePassengerCar,
  parsePassengerAsk,
  seatsOfCar,
} from './large-passenger';
import { emptyLexicon, type VehicleLexicon } from './fuzzy-vehicle-name';
import {
  resumenAsksForListedPrice,
  resumenAsksForOtherColor,
  resumenCabina,
  resumenHasPendingDoubt,
  resumenPideOtras,
  resumenPidePresupuesto,
  resumenStaysOnShownUnit,
  solicitudSinBanderas,
  vehicleClientePidio,
  textAsksForOtherColor,
} from '../intelligence/parse-resumen';
import { InterestedCarSnapshot } from '../persistence/lead.types';
import { sanitizePlateShort } from '../catalog/plate-short';
import { resumenTipoPatio, resumenTopeContado } from '../intelligence/parse-resumen';
import { hasLoadedPrice } from './strip-unsolicited-price';

export type ShownCarContext = {
  text: string;
  resumen?: string | null;
  history?: { role: string; content: string }[];
  car: InterestedCarSnapshot | null;
  lexicon?: VehicleLexicon;
  /** Vehículo que el resumen ya tiene como pedido del cliente. */
  pedido?: string | null;
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

function namedOtherUnit(
  text: string,
  car: InterestedCarSnapshot,
  lexicon: VehicleLexicon,
): boolean {
  const asked = detectNamedModelAsk(text, lexicon);
  if (!asked || isDriveFamily(asked.family)) {
    return false;
  }
  if (askedMatchesShownModel(asked.family, car.model)) {
    return Boolean(asked.year && car.year && asked.year !== car.year);
  }
  return true;
}

/** Otro año, versión o color: ya no es la unidad que mostramos. */
function askedOtherUnitFacts(
  text: string,
  car: InterestedCarSnapshot,
  lexicon?: VehicleLexicon,
): boolean {
  const asked = detectNamedModelAsk(text, lexicon);
  const year = asked ? asked.year : detectYearInText(text);
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

/** Dejó la unidad mostrada: otro carro, o el resumen decidió que pidió otra. */
export function leftShownCar(input: ShownCarContext): boolean {
  const car = input.car;
  if (!car) {
    return false;
  }
  const lexicon = input.lexicon ?? emptyLexicon();
  const resumen = input.resumen ?? '';
  // Lo que nombró ESTE turno lo dice el resumen si sigue en la unidad mostrada.
  const nombra = textoQueNombra(resumen, input.text, lexicon);
  // Del resumen se lee el pedido de ESTE turno (solicitud + vehículo), no el
  // Contexto de turnos viejos: ahí una palabra suelta («otra opción») ensucia.
  const pedidoResumen = solicitudSinBanderas(resumen)
    ? [solicitudSinBanderas(resumen), vehicleClientePidio(resumen) ?? ''].join('\n')
    : resumen;
  if (
    textAsksForOtherColor(input.text) ||
    resumenAsksForOtherColor(resumen)
  ) {
    return true;
  }
  if (resumenPideOtras(resumen)) {
    return true;
  }
  const stays = resumenStaysOnShownUnit(resumen);
  if (!stays && namedOtherUnit(nombra, car, lexicon)) {
    return true;
  }
  const budget = resumenTopeContado(resumen);
  if (
    resumenPidePresupuesto(resumen) &&
    budget &&
    (!car.price || budget < car.price)
  ) {
    return true;
  }
  if (
    !stays &&
    resumenAsksForListedPrice(resumen) &&
    input.history?.length
  ) {
    if (!historyPresentedFicha(input.history, car.model, input.resumen)) {
      const last = [...input.history]
        .reverse()
        .find((item) => item.role === 'assistant');
      if (last && !textMentionsModel(last.content, car.model)) {
        return true;
      }
    }
  }
  if (pedidoResumen && namedOtherUnit(pedidoResumen, car, lexicon)) {
    return true;
  }
  if (input.pedido && !vehicleLabelFitsCar(input.pedido, car, lexicon)) {
    const asked = detectNamedModelAsk(input.pedido, lexicon);
    if (
      !sameShownUnitAsk(asked, car) ||
      askedOtherUnitFacts(input.pedido, car, lexicon)
    ) {
      return true;
    }
  }
  if (askedOtherUnitFacts(nombra, car, lexicon)) {
    return true;
  }
  if (pedidoResumen && askedOtherUnitFacts(pedidoResumen, car, lexicon)) {
    return true;
  }
  const otherBrand = detectBrand(nombra, lexicon);
  if (
    otherBrand &&
    otherBrand !== car.brand.trim().toLowerCase() &&
    detectNamedModelAsk(nombra, lexicon)?.brand !==
      car.brand.trim().toLowerCase()
  ) {
    return true;
  }
  const box = detectGearbox(input.text, lexicon);
  const shownBox = gearboxOf(car);
  if (box && shownBox && box !== shownBox) {
    return true;
  }
  const shownKind = kindFromTypeBody(car.typeBody);
  const tipoPatio = resumenTipoPatio(input.resumen ?? '');
  if (tipoPatio && tipoPatio !== 'no' && shownKind && tipoPatio !== shownKind) {
    return true;
  }
  const saidKind =
    detectVehicleKind(input.text) ||
    (input.resumen ? detectVehicleKind(input.resumen) : null);
  if (saidKind && shownKind && saidKind !== shownKind) {
    return true;
  }
  const askedCab =
    resumenCabina(input.resumen ?? '') ?? detectAskedCab(input.text);
  const shownCab = unitCab(car);
  if (askedCab && shownCab && askedCab !== shownCab) {
    return true;
  }
  const askedDrive = detectAskedDrive(
    `${input.text}\n${input.resumen ?? ''}`,
  );
  const shownDrive = unitDrive(car);
  if (
    askedDrive &&
    (shownDrive === '4x2' || shownDrive === '4x4') &&
    askedDrive !== shownDrive &&
    !resumenHasPendingDoubt(input.resumen ?? '') &&
    !textAsksAboutShownDrive(input.text)
  ) {
    return true;
  }
  const spaceText = `${input.text}\n${input.resumen ?? ''}`;
  if (asksForLargePassengerSpace(spaceText)) {
    if (!isLargePassengerCar({ model: car.model, typeBody: car.typeBody })) {
      return true;
    }
    const want = parsePassengerAsk(spaceText);
    const have = seatsOfCar(car.passengerCapacity);
    if (want && want >= 8 && (have == null || have < 7)) {
      return true;
    }
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
      car.mileage && car.mileage > 0
        ? `km=${Math.round(car.mileage)}`
        : 'km=aún no cargado (NO digas 0 km; el dato no está en patio)',
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
      car.mileage && car.mileage > 0
        ? `\nkm=${Math.round(car.mileage)} (para contestar el km o justificar, no para repetir la ficha)`
        : after === 'facts'
          ? '\nkm=aún no cargado (NO digas 0 km; si pregunta el kilometraje, dilo: todavía no está en patio)'
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
  const facts = [
    formatMileageFact(car.mileage, car.year, new Date().getFullYear(), {
      skipClientCare: options?.skipMileageCare === true,
    }),
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
El resumen y el historial dicen cómo sigue el hilo: si pidió otro año, versión o modelo, busca esa unidad en inventario. Si no cambió de carro, sigue ESTA.`;
}
