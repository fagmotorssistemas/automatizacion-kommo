import { kindFromTypeBody } from '../conversation/vehicle-kind';
import { hasLoadedMileage } from './mileage';
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

function isDriveToken(part: string): boolean {
  return /^(?:4x[24]|x[24]|4wd|awd)$/i.test(part);
}

export function modelFamily(model: string): string {
  const normalized = normalizeModelText(model);
  const skip = new Set(['new', 'ac', 'all', 'gran', 'next']);
  const parts = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  const token = parts.find(
    (part) => part.length >= 3 && !skip.has(part) && !isDriveToken(part),
  );
  if (token) {
    return token;
  }
  return parts.find((part) => /^[a-z]\d{1,3}$/i.test(part)) ?? '';
}

/** Unidades que el último mensaje del bot realmente nombró (año/km/color), no toda la línea. */
export function carsShownInText(text: string, cars: StockCar[]): StockCar[] {
  const mentioned = cars.filter((car) => textMentionsModel(text, car.model));
  if (mentioned.length === 0) {
    return [];
  }
  const folded = text.toLowerCase();
  const tight = mentioned.filter((car) => {
    const yearHit =
      car.year != null && new RegExp(`\\b${car.year}\\b`).test(text);
    const kmHit =
      typeof car.mileage === 'number' &&
      car.mileage > 0 &&
      text.includes(String(Math.round(car.mileage)));
    const colorHit = Boolean(
      car.color && folded.includes(car.color.trim().toLowerCase()),
    );
    return (yearHit && (kmHit || colorHit)) || kmHit;
  });
  if (tight.length > 0) {
    return tight;
  }
  const byYear = mentioned.filter(
    (car) => car.year != null && new RegExp(`\\b${car.year}\\b`).test(text),
  );
  return byYear.length > 0 ? byYear : mentioned;
}

/** Todas las unidades que el bot ya nombró en el hilo, no solo el último turno. */
export function carsShownInHistory(
  history: { role: string; content: string }[],
  cars: StockCar[],
  extraText = '',
): StockCar[] {
  const byId = new Map<string, StockCar>();
  for (const item of history) {
    if (item.role !== 'assistant' || !item.content) {
      continue;
    }
    for (const car of carsShownInText(item.content, cars)) {
      byId.set(car.id, car);
    }
  }
  if (extraText.trim()) {
    for (const car of carsShownInText(extraText, cars)) {
      byId.set(car.id, car);
    }
  }
  return [...byId.values()];
}

export function shownThreadText(
  history: { role: string; content: string }[],
  extraText = '',
): string {
  return [
    ...history
      .filter((item) => item.role === 'assistant' && item.content)
      .map((item) => item.content),
    extraText,
  ]
    .filter((part) => part.trim())
    .join('\n');
}

/** Ya hay ficha de patio: no reabrir búsqueda. */
export function hasUsableFicha(car: StockCar): boolean {
  return Boolean(
    car.id &&
      car.model &&
      (car.year != null ||
        (typeof car.mileage === 'number' && car.mileage > 0) ||
        (typeof car.price === 'number' && car.price > 0)),
  );
}

/** Elige de las ya mostradas por el año que dijo, aunque el patio no traiga year. */
export function pickShownByYear(
  shown: StockCar[],
  text: string,
  year: number,
): StockCar[] {
  const exact = shown.filter((car) => car.year === year);
  if (exact.length > 0) {
    return exact;
  }
  if (!new RegExp(`\\b${year}\\b`).test(text)) {
    return [];
  }
  const folded = text.toLowerCase();
  return shown.filter((car) => {
    if (car.year != null && car.year !== year) {
      return false;
    }
    const kmHit =
      typeof car.mileage === 'number' &&
      car.mileage > 0 &&
      text.includes(String(Math.round(car.mileage)));
    const colorHit = Boolean(
      car.color && folded.includes(car.color.trim().toLowerCase()),
    );
    return kmHit || colorHit || car.year == null;
  });
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

export type UnitFactSource = {
  model: string;
  year?: number | null;
  color?: string | null;
  transmission?: string | null;
  driveType?: string | null;
  doorsCount?: number | null;
  mileage?: number | null;
  price?: number | null;
  plateShort?: string | null;
  id?: string;
  inventoryId?: string;
};

const DOORS_CODE = /\b([3-5])\s*p\b/i;
const DRIVE_CODE = /\b4\s*x\s*([24])\b/i;
const LOOKS_LIKE_DOORS = /^\s*[3-5]\s*p\s*$/i;
const LOOKS_LIKE_DRIVE = /^\s*4\s*x\s*[24]\s*$/i;

/** Caja = manual/automática. 4p y 4x2 nunca son transmisión. */
export function unitCaja(car: UnitFactSource): string | null {
  const field = (car.transmission ?? '').trim();
  const lower = field.toLowerCase();
  if (field && !LOOKS_LIKE_DOORS.test(field) && !LOOKS_LIKE_DRIVE.test(field)) {
    if (/manu|mec[aá]n/.test(lower) || /^t\/?m$/.test(lower)) {
      return 'manual';
    }
    if (/autom/.test(lower) || /^cvt$/.test(lower) || /^t\/?a$/.test(lower)) {
      return 'automática';
    }
  }
  if (/\btm\b/i.test(car.model)) {
    return 'manual';
  }
  if (/\bta\b/i.test(car.model) || /\bcvt\b/i.test(car.model)) {
    return 'automática';
  }
  return null;
}

/** 3p/4p/5p en ficha o en el modelo son puertas. */
export function unitDoors(car: UnitFactSource): number | null {
  if (car.doorsCount && car.doorsCount > 0) {
    return car.doorsCount;
  }
  const fromField = (car.transmission ?? '').match(/^\s*([3-5])\s*p\s*$/i);
  if (fromField) {
    return Number(fromField[1]);
  }
  const fromName = car.model.match(DOORS_CODE);
  return fromName ? Number(fromName[1]) : null;
}

/** 4x2/4x4 es tracción, no caja. */
export function unitDrive(car: UnitFactSource): string | null {
  const field = (car.driveType ?? '').trim();
  if (LOOKS_LIKE_DRIVE.test(field)) {
    return field.replace(/\s+/g, '').toLowerCase();
  }
  if (field && !LOOKS_LIKE_DOORS.test(field)) {
    return field;
  }
  const fromTx = (car.transmission ?? '').match(/^\s*(4\s*x\s*[24])\s*$/i);
  if (fromTx) {
    return fromTx[1].replace(/\s+/g, '').toLowerCase();
  }
  const fromName = car.model.match(DRIVE_CODE);
  return fromName ? `4x${fromName[1]}` : null;
}

export const UNIT_FIELD_LEGEND =
  'Etiquetas: modelo/año/color/km se copian. caja=solo manual o automática (si es sin dato, no hables de transmisión). puertas=3p/4p/5p (NUNCA "transmisión 4p"). tracción=4x2/4x4 (NUNCA "transmisión 4x2"). tm=manual, ta/cvt=automática. plate_short="La placa es P8".';

function etiqueta(car: StockCar, includePrice = false): string {
  const price =
    includePrice && car.price && car.price > 0
      ? `, $${Math.round(car.price)}`
      : '';
  const year = car.year ? ` ${car.year}` : '';
  return `${prettyFamily(car.model)}${year}${price}`;
}

/** Ficha etiquetada: cada campo dice qué es. El robot arma la frase con eso. */
export function describeUnit(car: StockCar, includePrice = false): string {
  const caja = unitCaja(car);
  const puertas = unitDoors(car);
  const traccion = unitDrive(car);
  const plate = sanitizePlateShort(car.plateShort);
  const km = hasLoadedMileage(car.mileage)
    ? `km=${Math.round(car.mileage as number)}`
    : car.mileage != null && Number.isFinite(car.mileage)
      ? 'km=aún no cargado (NO digas 0 km)'
      : '';
  const fields = [
    `modelo=${car.model}`,
    car.year ? `año=${car.year}` : '',
    car.color ? `color=${car.color}` : '',
    `caja=${caja ?? 'sin dato'}`,
    puertas != null ? `puertas=${puertas}` : '',
    `tracción=${traccion ?? 'sin dato'}`,
    km,
    includePrice && car.price && car.price > 0
      ? `precio=$${Math.round(car.price)}`
      : '',
    plate
      ? `plate_short=${plate}`
      : 'sin plate_short (PROHIBIDO inventar placa; el km NO es placa)',
    `inventory_id=${car.id}`,
  ].filter(Boolean);
  return `${UNIT_FIELD_LEGEND}\n${fields.join(' | ')}`;
}

/** Del 2010 en adelante se ofrece. Un 2016 no es antiguo. */
const ANIO_VIGENTE_DESDE = 2010;

/**
 * Si hay unidades del 2010 en adelante, no mezcla las anteriores.
 * Si solo hay antiguas, se quedan. Si pidió ese año antiguo, se presenta ese.
 */
export function preferCurrentYears<T extends { year?: number | null }>(
  cars: T[],
  askedYear?: number | null,
): T[] {
  if (askedYear != null && askedYear < ANIO_VIGENTE_DESDE) {
    const exact = cars.filter((car) => car.year === askedYear);
    return exact.length > 0 ? exact : cars;
  }
  const kept = cars.filter(
    (car) => car.year == null || car.year >= ANIO_VIGENTE_DESDE,
  );
  const vigentes = kept.filter((car) => car.year != null);
  if (vigentes.length === 0) {
    return cars;
  }
  return [...kept].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

/** Una unidad se manda. Varias se nombran para que elija. */
export function formatNamedUnits(
  cars: StockCar[],
  includePrice = false,
): {
  text: string;
  holdVehicle: boolean;
  sendId: string | null;
  unitPrice: number | null;
} {
  if (cars.length === 1) {
    const car = cars[0];
    const unitPrice =
      car.price && car.price > 0 ? Math.round(car.price) : null;
    return {
      text: `De este modelo hay una sola unidad y hay que mandarla: ${describeUnit(car, includePrice)}.
En meta.vehiculo.inventory_id pon exactamente "${car.id}".`,
      holdVehicle: false,
      sendId: car.id,
      unitPrice,
    };
  }

  return {
    text: `De este modelo hay ${cars.length} unidades. Nómbralas todas y pregunta cuál le interesa. No elijas una. No mandes fotos: vehiculo null.
${cars.map((car) => describeUnit(car, includePrice)).join('\n')}`,
    holdVehicle: true,
    sendId: null,
    unitPrice: null,
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
  if (isCityLetterCode(family)) {
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
  const suvs = pool
    .filter((car) => kindFromTypeBody(car.typeBody) === 'suv')
    .sort(byPrice);
  if (suvs.length > 0) {
    return [suvs[0]];
  }
  const rest = [...pool].sort(byPrice);
  return rest.length > 0 ? [rest[0]] : [];
}

function sameAskedUnit(
  car: StockCar,
  family: string,
  year: number | null,
): boolean {
  if (year != null && car.year !== year) {
    return false;
  }
  return (
    textMentionsModel(car.model, family) ||
    modelFamily(car.model) === modelFamily(family)
  );
}

/** No hay el modelo (o el año) pedido: primero dilo, después ofrece otra. */
export function formatMissingNamedModel(
  family: string,
  year: number | null,
  alternatives: StockCar[],
  includePrice = false,
): {
  text: string;
  holdVehicle: boolean;
  sendId: string | null;
  unitPrice: number | null;
} {
  const same = alternatives.filter((car) => sameAskedUnit(car, family, year));
  if (same.length > 0) {
    return formatNamedUnits(same, includePrice);
  }
  const pretty = family.charAt(0).toUpperCase() + family.slice(1);
  const asked = year ? `${pretty} ${year}` : pretty;
  const header = `No hay ${asked} en patio. PRIMERO dilo claro: no tenemos ${asked}. DESPUÉS, si hay una de abajo, ofrece ESA (lo más cercano en tamaño). Prohibido presentarla como si fuera el ${pretty}. Prohibido volver al carro que el cliente ya dejó.`;
  if (alternatives.length === 1) {
    const car = alternatives[0];
    const unitPrice =
      car.price && car.price > 0 ? Math.round(car.price) : null;
    return {
      text: `${header}
Lo más cercano, y hay que mandarlo solo después de decir que no hay ${asked}: ${describeUnit(car, includePrice)}.
En meta.vehiculo.inventory_id pon exactamente "${car.id}".`,
      holdVehicle: false,
      sendId: car.id,
      unitPrice,
    };
  }
  if (alternatives.length > 1) {
    return {
      text: `${header}
Nómbralas para que elija. vehiculo null.
${alternatives.map((car) => describeUnit(car, includePrice)).join('\n')}`,
      holdVehicle: true,
      sendId: null,
      unitPrice: null,
    };
  }
  return {
    text: `${header}
No hay otra unidad cercana en tamaño. Pregunta si quiere ver otra línea. vehiculo null.`,
    holdVehicle: true,
    sendId: null,
    unitPrice: null,
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
