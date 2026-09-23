import { kindFromTypeBody } from '../conversation/vehicle-kind';
import { formatUnitMileage } from './mileage';
import { sanitizePlateShort } from './plate-short';

export type FilaClase = 'tres_filas' | 'posible' | 'no' | 'no_consta';

export type StockCar = {
  id: string;
  brand: string;
  model: string;
  year: number | null;
  price: number | null;
  typeBody: string | null;
  color?: string | null;
  version?: string | null;
  mileage?: number | null;
  transmission?: string | null;
  fuelType?: string | null;
  passengerCapacity?: string | null;
  doorsCount?: number | null;
  driveType?: string | null;
  vin?: string | null;
  /** Apodo corto de placa para el cliente (ej. P7). No es la placa completa. */
  plateShort?: string | null;
  /** Salesbot de fotos en Kommo. Null/0 = no hay fotos. */
  botId?: number | null;
};

const SIN_TERCERA_FILA = new Set([
  'sedan',
  'cupé',
  'cupe',
  'hatchback',
  'hatckback',
  'doble cabina',
  'cabina doble',
  'cabina simple',
]);

const NO_EN_NOMBRE =
  /\b(?:sentra|versa|kicks|march|frontier|qashqai|altima|note|sunny|tiida)\b/i;

const TRES_FILAS_EN_NOMBRE =
  /\b7\s*pas(?:ajeros)?\b|\b7pas\b|\b(?:3|tres)\s+filas?\b/i;

const FAMILIA_TRES_FILAS =
  /\b(?:pathfinder|patrol|armada|fortuner|explorer|expedition|pilot|highlander|palisade|carnival|odyssey|sienna|tahoe|suburban|everest|cx-?9)\b/i;

const FAMILIA_POSIBLE = /\bx[\s-]?trail\b|\bxtrail\b|\bcaptiva\b|\btrailblazer\b|\bmontero\b/i;

export function normalizeModelText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\bx[\s-]?trail\b/g, 'xtrail')
    .replace(/\b4[\s-]*runner\b/g, '4runner')
    .replace(/\bland\s*cruiser\s*prado\b/g, 'prado')
    .replace(/\blc\s*prado\b/g, 'prado')
    .replace(/\bgrand?\s*vitara\b/g, 'vitara')
    .replace(/-/g, '');
}

export function modelFamily(model: string): string {
  const normalized = normalizeModelText(model);
  const skip = new Set(['new', 'ac', 'all', 'gran', 'next']);
  const token = normalized
    .split(/[^a-z0-9]+/)
    .find((part) => part.length >= 3 && !skip.has(part));
  return token ?? '';
}

export function textMentionsModel(text: string, model: string): boolean {
  const family = modelFamily(model);
  if (!family) {
    return false;
  }
  const normalized = normalizeModelText(text);
  return new RegExp(`\\b${family}\\b`, 'i').test(normalized);
}

export function userNamedModel(texts: string[], cars: { model: string }[]): boolean {
  const blob = texts.join('\n');
  return cars.some((car) => textMentionsModel(blob, car.model));
}

/** Mira el carro que sí está en patio. 5p en la ficha son puertas, no pasajeros. */
export function clasificarFilas(model: string, typeBody: string | null): FilaClase {
  const name = model.toLowerCase();
  if (TRES_FILAS_EN_NOMBRE.test(name)) {
    return 'tres_filas';
  }
  if (typeBody && SIN_TERCERA_FILA.has(typeBody.toLowerCase())) {
    return 'no';
  }
  if (NO_EN_NOMBRE.test(name)) {
    return 'no';
  }
  if (FAMILIA_TRES_FILAS.test(name)) {
    return 'tres_filas';
  }
  if (FAMILIA_POSIBLE.test(name)) {
    return 'posible';
  }
  return 'no_consta';
}

function prettyFamily(model: string): string {
  const family = modelFamily(model);
  if (family === 'xtrail') {
    return 'X-Trail';
  }
  if (!family) {
    return model;
  }
  return family.charAt(0).toUpperCase() + family.slice(1);
}

function etiqueta(car: StockCar, includePrice = false): string {
  const price =
    includePrice && car.price && car.price > 0
      ? `, $${Math.round(car.price)}`
      : '';
  const year = car.year ? ` ${car.year}` : '';
  return `${prettyFamily(car.model)}${year}${price}`;
}

/** Ficha de inventoryoracle: modelo tal cual, sin inventar MAX/TRAIL. */
export function describeUnit(car: StockCar, includePrice = false): string {
  const extras = [
    car.color,
    car.transmission ||
      (/\btm\b/i.test(car.model)
        ? 'manual'
        : /\bta\b/i.test(car.model)
          ? 'automática'
          : ''),
    car.driveType ||
      (/\b4x4\b/i.test(car.model)
        ? '4x4'
        : /\b4x2\b/i.test(car.model)
          ? '4x2'
          : ''),
  ].filter(Boolean);
  const extra = extras.length ? `, ${extras.join(', ')}` : '';
  const year = car.year ? ` ${car.year}` : '';
  const price =
    includePrice && car.price && car.price > 0
      ? `, $${Math.round(car.price)}`
      : '';
  const km = formatUnitMileage(car.mileage);
  const plate = sanitizePlateShort(car.plateShort);
  const plateBit = plate
    ? `, plate_short=${plate}`
    : ', sin plate_short (PROHIBIDO inventar placa; el km NO es placa)';
  return `${car.model}${year}${extra}${km}${price}${plateBit} (inventory_id=${car.id})`;
}

/** Una unidad se manda. Varias se nombran para que elija. */
export function formatNamedUnits(
  cars: StockCar[],
  includePrice = false,
): { text: string; holdVehicle: boolean; sendId: string | null } {
  if (cars.length === 1) {
    const car = cars[0];
    return {
      text: `De este modelo hay una sola unidad y hay que mandarla: ${describeUnit(car, includePrice)}.
En meta.vehiculo.inventory_id pon exactamente "${car.id}".`,
      holdVehicle: false,
      sendId: car.id,
    };
  }

  return {
    text: `De este modelo hay ${cars.length} unidades. Nómbralas todas y pregunta cuál le interesa. No elijas una. No mandes fotos: vehiculo null.
${cars.map((car) => describeUnit(car, includePrice)).join('\n')}`,
    holdVehicle: true,
    sendId: null,
  };
}

/** i10 / y10 / i20: city hatch, no un SUV de la misma marca. */
export function isCityLetterCode(family: string): boolean {
  return /^[iy]\d{1,2}$/i.test(family);
}

/**
 * Si el pedido no está en patio, el más cercano en tamaño.
 * Un i10 no se sustituye por un Kona; el Sportage ya rechazado no vuelve.
 */
export function pickClosestToMissingModel(
  cars: StockCar[],
  family: string,
  except?: { inventoryId?: string | null; family?: string | null },
): StockCar[] {
  if (!isCityLetterCode(family)) {
    return [];
  }
  const pool = cars.filter((car) => {
    if (except?.inventoryId && car.id === except.inventoryId) {
      return false;
    }
    if (except?.family && textMentionsModel(car.model, except.family)) {
      return false;
    }
    return true;
  });
  const byPrice = (a: StockCar, b: StockCar) =>
    (a.price ?? Number.POSITIVE_INFINITY) -
    (b.price ?? Number.POSITIVE_INFINITY);
  const hatches = pool
    .filter((car) => kindFromTypeBody(car.typeBody) === 'hatchback')
    .sort(byPrice);
  if (hatches.length > 0) {
    return [hatches[0]];
  }
  const sedans = pool
    .filter((car) => kindFromTypeBody(car.typeBody) === 'sedan')
    .sort(byPrice);
  if (sedans.length > 0) {
    return [sedans[0]];
  }
  return [];
}

/** No hay el modelo (o el año) pedido: primero dilo, después ofrece otra. */
export function formatMissingNamedModel(
  family: string,
  year: number | null,
  alternatives: StockCar[],
  includePrice = false,
): { text: string; holdVehicle: boolean; sendId: string | null } {
  const pretty = family.charAt(0).toUpperCase() + family.slice(1);
  const asked = year ? `${pretty} ${year}` : pretty;
  const header = `No hay ${asked} en patio. PRIMERO dilo claro: no tenemos ${asked}. DESPUÉS, si hay una de abajo, ofrece ESA (lo más cercano en tamaño). Prohibido presentarla como si fuera el ${pretty}. Prohibido volver al carro que el cliente ya dejó.`;
  if (alternatives.length === 1) {
    const car = alternatives[0];
    return {
      text: `${header}
Lo más cercano, y hay que mandarlo solo después de decir que no hay ${asked}: ${describeUnit(car, includePrice)}.
En meta.vehiculo.inventory_id pon exactamente "${car.id}".`,
      holdVehicle: false,
      sendId: car.id,
    };
  }
  if (alternatives.length > 1) {
    return {
      text: `${header}
Nómbralas para que elija. vehiculo null.
${alternatives.map((car) => describeUnit(car, includePrice)).join('\n')}`,
      holdVehicle: true,
      sendId: null,
    };
  }
  return {
    text: `${header}
No hay otra unidad cercana en tamaño. Pregunta si quiere ver otra línea. vehiculo null.`,
    holdVehicle: true,
    sendId: null,
  };
}

export function formatRevisionMarca(input: {
  marca: string;
  cars: StockCar[];
  tresFilas: boolean;
  soloMarca: boolean;
  includePrice?: boolean;
}): string {
  const lineas = [...new Set(input.cars.map((car) => prettyFamily(car.model)))];
  const parts = [`MARCA VIGENTE: ${input.marca}`];

  if (input.soloMarca) {
    parts.push(
      `El cliente solo dijo la marca. Líneas en patio: ${lineas.join(', ')}. Pregunta cuál le interesa. No elijas una. No mandes fotos: vehiculo null.`,
    );
  }

  if (!input.tresFilas) {
    return parts.join('\n');
  }

  const marked = input.cars.map((car) => ({
    car,
    clase: clasificarFilas(car.model, car.typeBody),
  }));
  const list = (clase: FilaClase) =>
    marked
      .filter((item) => item.clase === clase)
      .map((item) => etiqueta(item.car, input.includePrice === true))
      .join('; ');

  const confirmados = list('tres_filas');
  const posibles = list('posible');
  const no = list('no');

  parts.push(
    'REVISIÓN DE TRES FILAS (solo estos carros de la marca, ya revisados en inventario):',
  );
  parts.push(
    confirmados
      ? `Sí tienen 3 filas: ${confirmados}.`
      : 'Ninguno trae 7 pasajeros escrito en la ficha.',
  );
  parts.push(
    posibles
      ? `Pueden tener 3 filas. Ofrécelos y pregunta cuál quiere ver: ${posibles}.`
      : 'No hay otro modelo de esta marca que pueda traer 3 filas.',
  );
  if (no) {
    parts.push(`No son de 3 filas: ${no}.`);
  }
  parts.push(
    'No ofrezcas otra marca. No digas que no hay y no cierres la conversación. 5p en el nombre son puertas, no pasajeros.',
  );
  if (input.soloMarca) {
    parts.push('vehiculo null hasta que elija uno.');
  }

  return parts.join('\n');
}
