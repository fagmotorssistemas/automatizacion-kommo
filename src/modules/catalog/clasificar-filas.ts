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

export function modelFamily(model: string): string {
  const normalized = model.toLowerCase().replace(/\bx[\s-]?trail\b/g, 'xtrail');
  const skip = new Set(['new', 'ac', 'all', 'gran']);
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
  const normalized = text.toLowerCase().replace(/\bx[\s-]?trail\b/g, 'xtrail');
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
