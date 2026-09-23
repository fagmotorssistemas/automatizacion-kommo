import { modelFamily, StockCar } from '../catalog/clasificar-filas';
import { kindFromTypeBody, VehicleKind } from './vehicle-kind';
import { detectBrandFromModel } from './vehicle-brand';
import { emptyLexicon, type VehicleLexicon } from './fuzzy-vehicle-name';

export type Gearbox = 'manual' | 'automatica';

const MANUAL = /\b(?:manual(?:es)?|mec[aá]nic[oa]s?|manuak|manaul)\b/gi;
const MANUEL_TYPO = /\bmanue?l\b/gi;
const AUTOMATIC = /\bautom[aá]tic[oa]s?\b/gi;

/** 25% alrededor del precio del carro que ya estaban viendo. */
const PRICE_BAND = 0.25;

export function detectGearbox(
  text: string,
  lexicon: VehicleLexicon = emptyLexicon(),
): Gearbox | null {
  let winner: { gearbox: Gearbox; index: number } | null = null;
  const detectors: { gearbox: Gearbox; pattern: RegExp }[] = [
    { gearbox: 'manual', pattern: MANUAL },
    { gearbox: 'automatica', pattern: AUTOMATIC },
  ];
  if (detectBrandFromModel(text, lexicon)) {
    detectors.push({ gearbox: 'manual', pattern: MANUEL_TYPO });
  }
  for (const detector of detectors) {
    detector.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = detector.pattern.exec(text)) !== null) {
      if (!winner || match.index >= winner.index) {
        winner = { gearbox: detector.gearbox, index: match.index };
      }
    }
  }
  return winner?.gearbox ?? null;
}

/** `tm` en el modelo es manual. `ta` es automática. El campo transmission manda si viene. */
export function gearboxOf(car: {
  model: string;
  transmission?: string | null;
}): Gearbox | null {
  const field = (car.transmission ?? '').toLowerCase();
  if (/manu|mec[aá]n/.test(field)) {
    return 'manual';
  }
  if (/autom/.test(field)) {
    return 'automatica';
  }
  const name = car.model.toLowerCase();
  if (/\btm\b/.test(name)) {
    return 'manual';
  }
  if (/\bta\b/.test(name)) {
    return 'automatica';
  }
  return null;
}

export function resolveGearbox(input: {
  history: { role: string; content: string }[];
  customerText: string;
  remembered: Gearbox | null;
  lexicon?: VehicleLexicon;
}): Gearbox | null {
  const lexicon = input.lexicon ?? emptyLexicon();
  const saidNow = detectGearbox(input.customerText, lexicon);
  if (saidNow) {
    return saidNow;
  }
  let gearbox = input.remembered;
  for (const text of input.history) {
    if (text.role !== 'user') {
      continue;
    }
    const found = detectGearbox(text.content, lexicon);
    if (found) {
      gearbox = found;
    }
  }
  return gearbox;
}

export function gearboxLabel(gearbox: Gearbox): string {
  return gearbox === 'manual' ? 'manual' : 'automática';
}

export function formatGearboxPedido(gearbox: Gearbox | null): string {
  if (!gearbox) {
    return '';
  }
  const label = gearboxLabel(gearbox);
  const other = gearbox === 'manual' ? 'automática' : 'manual';
  return `CAJA VIGENTE: ${label}
El cliente pidió transmisión ${label}. Sigue vigente aunque hable de crédito o de una entidad.
Prohibido volver a ofrecer la caja ${other}.
Si ese modelo no tiene ${label}, ofrece otro ${label} de precio parecido: primero sedán o hatchback, y solo si no hay ninguno, un SUV.`;
}

export type BodyGroup = 'chico' | 'suv' | 'camioneta';

export function bodyGroupOf(kind: VehicleKind | null): BodyGroup | null {
  if (kind === 'sedan' || kind === 'hatchback') {
    return 'chico';
  }
  if (kind === 'suv') {
    return 'suv';
  }
  if (kind === 'camioneta') {
    return 'camioneta';
  }
  return null;
}

export function carBodyGroup(typeBody: string | null | undefined): BodyGroup | null {
  return bodyGroupOf(kindFromTypeBody(typeBody));
}

export function priceIsClose(price: number, reference: number): boolean {
  if (reference <= 0 || price <= 0) {
    return false;
  }
  const ratio = price / reference;
  return ratio >= 1 - PRICE_BAND && ratio <= 1 + PRICE_BAND;
}

function inGroup(car: StockCar, group: BodyGroup): boolean {
  return carBodyGroup(car.typeBody) === group;
}

function byPriceDistance(reference: number) {
  return (a: StockCar, b: StockCar) =>
    Math.abs((a.price ?? 0) - reference) - Math.abs((b.price ?? 0) - reference);
}

export type GearboxPick = {
  cars: StockCar[];
  widenedToSuv: boolean;
  /** El mismo modelo sí existe en la caja pedida. */
  sameModel: boolean;
};

/** Mismo modelo en esa caja, si existe. Si no, precio parecido del mismo tipo. */
export function pickGearboxAlternatives(input: {
  cars: StockCar[];
  gearbox: Gearbox;
  family: string | null;
  group: BodyGroup | null;
  referencePrice: number | null;
}): GearboxPick | null {
  const matching = input.cars.filter((car) => gearboxOf(car) === input.gearbox);
  if (input.family) {
    const sameModel = matching.filter(
      (car) => modelFamily(car.model) === input.family,
    );
    if (sameModel.length > 0) {
      return { cars: sameModel, widenedToSuv: false, sameModel: true };
    }
  }

  if (!input.group || !input.referencePrice) {
    return matching.length > 0
      ? null
      : { cars: [], widenedToSuv: false, sameModel: false };
  }

  const close = (group: BodyGroup) =>
    matching
      .filter(
        (car) =>
          inGroup(car, group) &&
          car.price != null &&
          priceIsClose(car.price, input.referencePrice as number),
      )
      .sort(byPriceDistance(input.referencePrice as number))
      .slice(0, 3);

  const sameType = close(input.group);
  if (sameType.length > 0) {
    return { cars: sameType, widenedToSuv: false, sameModel: false };
  }
  if (input.group === 'chico') {
    const suv = close('suv');
    return { cars: suv, widenedToSuv: suv.length > 0, sameModel: false };
  }
  return { cars: [], widenedToSuv: false, sameModel: false };
}

function carLabel(car: StockCar, includePrice: boolean): string {
  const family = modelFamily(car.model);
  const name = family
    ? family.charAt(0).toUpperCase() + family.slice(1)
    : car.model;
  const year = car.year ? ` ${car.year}` : '';
  const price =
    includePrice && car.price && car.price > 0
      ? `, $${Math.round(car.price)}`
      : '';
  return `${car.brand} ${name}${year}${price} (inventory_id=${car.id})`;
}

export function formatGearboxAlternatives(input: {
  gearbox: Gearbox;
  pick: GearboxPick;
  includePrice: boolean;
}): { text: string; holdVehicle: boolean; sendId: string | null } {
  const label = gearboxLabel(input.gearbox);
  const other = input.gearbox === 'manual' ? 'automática' : 'manual';
  if (input.pick.cars.length === 0) {
    return {
      text: `No hay ${label} de precio parecido en sedán, hatchback ni SUV. No ofrezcas el de caja ${other}. vehiculo null.`,
      holdVehicle: true,
      sendId: null,
    };
  }

  const lines = input.pick.cars.map((car) => carLabel(car, input.includePrice));
  if (input.pick.cars.length === 1) {
    const car = input.pick.cars[0];
    const where = input.pick.widenedToSuv
      ? `No hay sedán ni hatchback ${label} cerca de ese precio. El SUV ${label} más cercano, y hay que mandarlo:`
      : `Ese modelo no tiene ${label}. Este ${label} es de precio parecido y del mismo tipo, y hay que mandarlo:`;
    return {
      text: `${where} ${lines[0]}.
Di que es lo más cercano en ${label}, no que es el mismo carro de caja ${other}.
Sedán y hatchback cuentan como el mismo tipo. Esta indicación manda sobre el tipo vigente.
Prohibido ofrecer la caja ${other}.
En meta.vehiculo.inventory_id pon exactamente "${car.id}".`,
      holdVehicle: false,
      sendId: car.id,
    };
  }

  const where = input.pick.widenedToSuv
    ? `No hay sedán ni hatchback ${label} cerca de ese precio. Estos SUV ${label} se acercan. Nómbralos para que elija. vehiculo null.`
    : `Ese modelo no tiene ${label}. Estos ${label} se acercan en precio y tipo. Nómbralos para que elija. vehiculo null.`;
  return {
    text: `${where}
${lines.join('\n')}
Prohibido ofrecer la caja ${other}.`,
    holdVehicle: true,
    sendId: null,
  };
}
