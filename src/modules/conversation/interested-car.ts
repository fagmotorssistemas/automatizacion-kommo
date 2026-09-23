import { modelFamily } from '../catalog/clasificar-filas';
import { formatMileageFact } from '../catalog/mileage';
import { detectVehicleKind, kindFromTypeBody } from './vehicle-kind';
import {
  colorMatches,
  detectBrand,
  detectColorInText,
  detectNamedModelAsk,
  detectTrimInText,
  detectYearInText,
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
  textAsksForOtherColor,
} from '../intelligence/parse-resumen';
import { InterestedCarSnapshot } from '../persistence/lead.types';

export type ShownCarContext = {
  text: string;
  resumen?: string | null;
  history?: { role: string; content: string }[];
  car: InterestedCarSnapshot | null;
  lexicon?: VehicleLexicon;
};

function namedOtherUnit(
  text: string,
  car: InterestedCarSnapshot,
  lexicon: VehicleLexicon,
): boolean {
  const asked = detectNamedModelAsk(text, lexicon);
  if (!asked) {
    return false;
  }
  if (asked.family !== modelFamily(car.model)) {
    return true;
  }
  return Boolean(asked.year && car.year && asked.year !== car.year);
}

/** Otro año, versión o color: ya no es la unidad que mostramos. */
function askedOtherUnitFacts(
  text: string,
  car: InterestedCarSnapshot,
): boolean {
  const year = detectYearInText(text);
  if (year && car.year && year !== car.year) {
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

/** El cliente dejó el hilo de la unidad mostrada (otro modelo/marca/caja/tipo/año). */
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
  if (input.resumen && namedOtherUnit(input.resumen, car, lexicon)) {
    return true;
  }
  if (askedOtherUnitFacts(input.text, car)) {
    return true;
  }
  if (input.resumen && askedOtherUnitFacts(input.resumen, car)) {
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

export function formatInterestedCar(
  car: InterestedCarSnapshot,
  includePrice = false,
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
  const tipo = kindFromTypeBody(car.typeBody);
  const tipoLine = tipo
    ? `\nTipo de este carro: ${tipo}. Sigue con este tipo salvo que nombre un modelo de otro tipo.`
    : '';
  const facts = [
    formatMileageFact(car.mileage, car.year),
    car.color ? `color=${car.color}` : '',
    car.transmission ? `caja=${car.transmission}` : '',
    car.plateShort ? `plate_short=${car.plateShort}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const factsLine = facts
    ? `\n${facts}
Estos datos son para responder si el resumen o el mensaje los piden. Placa: solo plate_short (nunca inventes una placa larga).`
    : '';
  return `VEHÍCULO DE INTERÉS (interested_cars, el último que pidió)
${car.brand} ${car.model}${year}${shown}
inventory_id=${car.inventoryId}${interno}${tipoLine}${factsLine}
El resumen y el historial dicen cómo sigue el hilo: si pidió otro año, versión o modelo, busca esa unidad en inventario. Si no cambió de carro, sigue ESTA.`;
}
