import {
  modelFamily,
  normalizeModelText,
  textMentionsModel,
  unitCaja,
  unitDoors,
  unitDrive,
} from '../catalog/clasificar-filas';
import { formatMileageFact } from '../catalog/mileage';
import { detectVehicleKind, kindFromTypeBody } from './vehicle-kind';
import {
  colorMatches,
  detectBrand,
  detectColorInText,
  detectNamedModelAsk,
  detectTrimInText,
  detectYearInText,
  isDriveFamily,
  modelHasTrim,
} from './vehicle-brand';
import { detectGearbox, gearboxOf } from './gearbox';
import {
  asksForLargePassengerSpace,
  isLargePassengerCar,
  parsePassengerAsk,
  seatsOfCar,
} from './large-passenger';
import { emptyLexicon, type VehicleLexicon } from './fuzzy-vehicle-name';
import {
  resumenAsksForOtherColor,
  resumenPideOtras,
  textAsksForOtherColor,
} from '../intelligence/parse-resumen';
import { InterestedCarSnapshot } from '../persistence/lead.types';
import { sanitizePlateShort } from '../catalog/plate-short';
import { detectCashBudget } from './budget';
import { parseResumen } from '../intelligence/parse-resumen';
import { hasLoadedPrice } from './strip-unsolicited-price';

export type ShownCarContext = {
  text: string;
  resumen?: string | null;
  history?: { role: string; content: string }[];
  car: InterestedCarSnapshot | null;
  lexicon?: VehicleLexicon;
};

/** El nombre pedido (T1, Getours T1) es la misma línea que ya está en patio. */
function askedMatchesShownModel(askedFamily: string, carModel: string): boolean {
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

/** Dejó la unidad mostrada: otro carro, o el resumen decidió que pidió otra. */
export function leftShownCar(input: ShownCarContext): boolean {
  const car = input.car;
  if (!car) {
    return false;
  }
  const lexicon = input.lexicon ?? emptyLexicon();
  if (
    textAsksForOtherColor(input.text) ||
    resumenAsksForOtherColor(input.resumen ?? '')
  ) {
    return true;
  }
  if (namedOtherUnit(input.text, car, lexicon)) {
    return true;
  }
  const budget =
    detectCashBudget(input.text) ??
    detectCashBudget(parseResumen(input.resumen ?? '').solicitudActual ?? '');
  if (budget && (!car.price || budget < car.price)) {
    return true;
  }
  if (resumenPideOtras(input.resumen ?? '')) {
    return true;
  }
  if (/\bprecios?\b/i.test(input.text) && input.history?.length) {
    const last = [...input.history]
      .reverse()
      .find((item) => item.role === 'assistant');
    if (last && !textMentionsModel(last.content, car.model)) {
      return true;
    }
  }
  if (input.resumen && namedOtherUnit(input.resumen, car, lexicon)) {
    return true;
  }
  if (askedOtherUnitFacts(input.text, car, lexicon)) {
    return true;
  }
  if (input.resumen && askedOtherUnitFacts(input.resumen, car, lexicon)) {
    return true;
  }
  const otherBrand = detectBrand(input.text, lexicon);
  if (
    otherBrand &&
    otherBrand !== car.brand.trim().toLowerCase() &&
    detectNamedModelAsk(input.text, lexicon)?.brand !==
      car.brand.trim().toLowerCase()
  ) {
    return true;
  }
  const box = detectGearbox(input.text, lexicon);
  const shownBox = gearboxOf(car);
  if (box && shownBox && box !== shownBox) {
    return true;
  }
  const saidKind = detectVehicleKind(input.text);
  const shownKind = kindFromTypeBody(car.typeBody);
  if (saidKind && shownKind && saidKind !== shownKind) {
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
): boolean {
  return followsShownCar({ text, car, lexicon });
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

/** El bot ya mandó la ficha de ESA unidad (historial o resumen). */
export function historyPresentedFicha(
  history: { role: string; content: string }[] | undefined,
  model: string | undefined,
  resumen?: string | null,
): boolean {
  if (
    resumen &&
    /fotos (?:enviadas|ya)|ficha (?:ya )?(?:enviada|mostrada)|ya (?:le )?(?:mostr|envi)/i.test(
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
    return (
      /\b\d{3,6}\s*km\b/i.test(item.content) ||
      /tenemos disponible|aqu[ií] (?:tiene(?: tambi[eé]n)? )?las fotos|le envi[eé] fotos|fotos del veh[ií]culo/i.test(
        item.content,
      )
    );
  });
}

export function formatInterestedCar(
  car: InterestedCarSnapshot,
  includePrice = false,
  options?: {
    skipMileageCare?: boolean;
    slimAfterFicha?: boolean;
    creditFollowUp?: boolean;
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
  if (options?.slimAfterFicha) {
    const km =
      car.mileage && car.mileage > 0
        ? `\nkm=${Math.round(car.mileage)} (para justificar el valor, no para repetir la ficha)`
        : '';
    const priceNote = hasLoadedPrice(car.price)
      ? ''
      : '\nprecio=aún no cargado (NO digas $0 ni $00; el dato no está en patio)';
    const close = options?.creditFollowUp
      ? 'YA vio esta unidad y el precio. Sigue ESA. Eligió el camino de financiamiento. PROHIBIDO repetir ficha, el $ ni “excelente estado / papeles / entrega”. Pregunta con cuánto de entrada y a qué plazo. No inventes cuota sin esos datos.'
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
