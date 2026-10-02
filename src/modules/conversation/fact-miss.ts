import {
  describeUnit,
  modelFamily,
  unitCab,
  unitDrive,
  type StockCar,
} from '../catalog/clasificar-filas';
import { asignarClavesPrecio, type PrecioClave } from '../catalog/precio-marcador';
import { colorMatches } from './vehicle-brand';
import { gearboxLabel, gearboxOf, type Gearbox } from './gearbox';
import { kindFromTypeBody, type VehicleKind } from './vehicle-kind';

function tipoLabel(kind: VehicleKind | string | null | undefined): string {
  if (kind === 'suv') {
    return 'SUV';
  }
  if (kind === 'sedan') {
    return 'sedán';
  }
  if (kind === 'hatchback') {
    return 'hatchback';
  }
  if (kind === 'camioneta') {
    return 'camioneta';
  }
  return kind?.trim() || 'unidad';
}

function tipoOf(car: StockCar): string {
  return tipoLabel(kindFromTypeBody(car.typeBody) ?? car.typeBody);
}

export type FactMissKind =
  | 'año'
  | 'color'
  | 'transmisión'
  | 'cabina'
  | 'tracción';

function cabLabel(cab: 'cs' | 'cd'): string {
  return cab === 'cd' ? 'cabina doble' : 'cabina simple';
}

export function askedFactLabel(
  kind: FactMissKind,
  asked: {
    year?: number | null;
    color?: string | null;
    gearbox?: Gearbox | null;
    cab?: 'cs' | 'cd' | null;
    drive?: '4x2' | '4x4' | null;
  },
): string {
  if (kind === 'año' && asked.year != null) {
    return String(asked.year);
  }
  if (kind === 'color' && asked.color) {
    return asked.color;
  }
  if (kind === 'transmisión' && asked.gearbox) {
    return gearboxLabel(asked.gearbox);
  }
  if (kind === 'cabina' && asked.cab) {
    return cabLabel(asked.cab);
  }
  if (kind === 'tracción' && asked.drive) {
    return asked.drive;
  }
  return kind;
}

export function shownFactLabel(kind: FactMissKind, car: StockCar): string {
  if (kind === 'año') {
    return car.year != null ? String(car.year) : 'otro año';
  }
  if (kind === 'color') {
    return car.color?.trim() || 'otro color';
  }
  if (kind === 'transmisión') {
    const box = gearboxOf(car);
    return box ? gearboxLabel(box) : 'otra caja';
  }
  if (kind === 'cabina') {
    const cab = unitCab(car);
    return cab ? cabLabel(cab) : 'otra cabina';
  }
  const drive = unitDrive(car);
  return drive ?? 'otra tracción';
}

/**
 * No hay el dato pedido: primero dilo, ofrece hasta 3 que SÍ lo cumplen,
 * y menciona la misma unidad con el dato distinto.
 */
export function formatFactMissInstruction(input: {
  kind: FactMissKind;
  brand: string;
  family: string;
  askedLabel: string;
  shown: StockCar | null;
  alts: StockCar[];
  includePrice: boolean;
  askedKind?: VehicleKind | string | null;
  widenedToSuv?: boolean;
}): {
  text: string;
  holdVehicle: boolean;
  sendId: string | null;
  listedUnits?: StockCar[];
  precioClaves?: PrecioClave[];
} {
  const familia = input.family || 'unidad';
  const compact = familia.replace(/-/g, '');
  const shownDiff = input.shown ? shownFactLabel(input.kind, input.shown) : '';
  const alts = input.alts.filter(
    (car) => !input.shown || car.id !== input.shown.id,
  );
  const askedKind =
    input.askedKind ??
    (input.shown
      ? kindFromTypeBody(input.shown.typeBody) ?? input.shown.typeBody
      : null);
  const askedTipo = tipoLabel(askedKind);
  const altTipos = [...new Set(alts.map((car) => tipoOf(car)))];
  const typeShifted =
    Boolean(input.widenedToSuv) ||
    (Boolean(askedKind) &&
      alts.some((car) => tipoOf(car).toLowerCase() !== askedTipo.toLowerCase()));
  const precioClaves = asignarClavesPrecio(
    [...alts, ...(input.shown ? [input.shown] : [])],
  );
  const claveDe = (id: string) =>
    precioClaves.find((item) => item.inventoryId === id)?.clave ?? 'u1';
  const lines = alts.map((car) => {
    const tipo = tipoOf(car);
    return `${describeUnit(car, input.includePrice, claveDe(car.id))} | tipo=${tipo}`;
  });
  const shownLine = input.shown
    ? describeUnit(input.shown, input.includePrice, claveDe(input.shown.id))
    : '';

  const lead =
    input.kind === 'año'
      ? `El cliente pidió ${input.brand} ${familia} ${input.askedLabel}. Ese año NO está en patio. Di primero, en una frase, que no tenemos el ${familia} ${input.askedLabel}. No hay ${compact} ${input.askedLabel}.`
      : `El cliente pidió ${input.brand} ${familia} con ${input.askedLabel}. Ese dato NO está en patio. Di primero, en una frase, que no tenemos el ${familia} con ${input.askedLabel}.`;

  const shownNote = input.shown
    ? `El ${familia} que tenemos es ${shownDiff}. Menciónalo aclarando la diferencia: ${shownLine}.`
    : '';

  const typeNote = typeShifted
    ? `No tenemos ${askedTipo} con ${input.askedLabel} como el ${familia}; tenemos estos ${altTipos.join(', ')}: ${alts.map((car) => `${car.brand} ${modelFamily(car.model) || car.model} (${tipoOf(car)})`).join(', ')}. PROHIBIDO presentarlas como ${askedTipo} si no lo son. El tipo real de cada una está en tipo=.`
    : '';

  if (alts.length === 0) {
    const noOtraLinea =
      input.kind === 'año' ? ' PROHIBIDO otra línea.' : '';
    return {
      text: `${lead}
No hay otra unidad que cumpla ${input.askedLabel}. Di que no tenemos. ${shownNote || 'No ofrezcas otra línea.'}${noOtraLinea}`.trim(),
      holdVehicle: false,
      sendId: input.shown?.id ?? null,
      listedUnits: input.shown ? [input.shown] : undefined,
      precioClaves,
    };
  }

  const offer =
    alts.length === 1
      ? `Luego ofrece esta unidad de patio que SÍ es ${input.askedLabel} (la más parecida): ${lines[0]}.`
      : `Luego ofrece hasta estas unidades de patio que SÍ son ${input.askedLabel} (las más parecidas):
${lines.join('\n')}`;

  return {
    text: `${lead}
${typeNote}
${offer}
${shownNote}`.trim(),
    holdVehicle: alts.length > 1,
    sendId: alts.length === 1 ? alts[0].id : null,
    listedUnits: alts,
    precioClaves,
  };
}

export function familyOfCar(car: { model: string } | null): string {
  if (!car) {
    return '';
  }
  return modelFamily(car.model) || car.model;
}

export type AskedFacts = {
  gearbox?: Gearbox | null;
  color?: string | null;
  year?: number | null;
  cab?: 'cs' | 'cd' | null;
  drive?: '4x2' | '4x4' | null;
};

export function mismatchesOf(car: StockCar, asked: AskedFacts): FactMissKind[] {
  const out: FactMissKind[] = [];
  const box = gearboxOf(car);
  if (asked.gearbox && box && box !== asked.gearbox) {
    out.push('transmisión');
  }
  if (asked.color && car.color && !colorMatches(car.color, asked.color)) {
    out.push('color');
  }
  if (asked.year != null && car.year != null && car.year !== asked.year) {
    out.push('año');
  }
  const cab = unitCab(car);
  if (asked.cab && cab && cab !== asked.cab) {
    out.push('cabina');
  }
  const drive = unitDrive(car);
  if (asked.drive && drive && drive !== asked.drive) {
    out.push('tracción');
  }
  return out;
}
