import {
  clasificarFilas,
  describeUnit,
  type StockCar,
} from '../catalog/clasificar-filas';
import { carBodyGroup } from './gearbox';

const VAN =
  /\b(?:furgonet\w*|furg[oó]n(?:es)?|minivans?|minib[uú]s(?:es)?|microb[uú]s(?:es)?|vans?)\b/i;

const SEAT_WORDS: { pattern: RegExp; seats: number }[] = [
  { pattern: /\bveinte\s+pasajeros?\b/i, seats: 20 },
  { pattern: /\bdiecisiete\s+pasajeros?\b/i, seats: 17 },
  { pattern: /\bquince\s+pasajeros?\b/i, seats: 15 },
  { pattern: /\bdoce\s+pasajeros?\b/i, seats: 12 },
  { pattern: /\bdiez\s+pasajeros?\b/i, seats: 10 },
];

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function parsePassengerAsk(text: string): number | null {
  const nums = [...text.matchAll(/(\d{1,2})\s*pasajeros?/gi)].map((match) =>
    Number(match[1]),
  );
  for (const word of SEAT_WORDS) {
    if (word.pattern.test(text)) {
      nums.push(word.seats);
    }
  }
  if (nums.length === 0) {
    return null;
  }
  return Math.max(...nums);
}

export function asksForLargePassengerSpace(text: string): boolean {
  if (!text.trim()) {
    return false;
  }
  if (VAN.test(text)) {
    return true;
  }
  const seats = parsePassengerAsk(text);
  if (seats != null && seats >= 8) {
    return true;
  }
  const n = fold(text);
  return /\b(varias personas|mucha gente|gran espacio)\b/.test(n);
}

export function seatsOfCar(capacity: string | number | null | undefined): number | null {
  if (capacity == null || capacity === '') {
    return null;
  }
  const n = Number(String(capacity).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** SUV/jeep con espacio. No sedán, no hatch, no pickup. */
export function isLargePassengerCar(car: {
  model: string;
  typeBody?: string | null;
  passengerCapacity?: string | number | null;
}): boolean {
  const group = carBodyGroup(car.typeBody);
  if (group === 'chico' || group === 'camioneta') {
    return false;
  }
  const seats = seatsOfCar(car.passengerCapacity);
  if (seats != null && seats >= 7) {
    return true;
  }
  const filas = clasificarFilas(car.model, car.typeBody ?? null);
  if (filas === 'tres_filas' || filas === 'posible') {
    return true;
  }
  return group === 'suv';
}

function scoreSpace(car: StockCar): number {
  const seats = seatsOfCar(car.passengerCapacity) ?? 0;
  const filas = clasificarFilas(car.model, car.typeBody);
  const bonus =
    filas === 'tres_filas' ? 20 : filas === 'posible' ? 10 : 0;
  return seats + bonus;
}

export function pickLargePassengerCars(cars: StockCar[]): StockCar[] {
  return cars
    .filter((car) => isLargePassengerCar(car))
    .sort((a, b) => scoreSpace(b) - scoreSpace(a));
}

/** Dato de ficha/patio, no del mensaje del cliente. */
export function seatsFromDato(dato: string): number | null {
  const labeled = dato.match(
    /(\d{1,2})\s*(?:pasaj\w*|asient\w*|puest\w*|plazas?)/i,
  );
  if (labeled) {
    const n = Number(labeled[1]);
    return Number.isFinite(n) && n >= 4 && n <= 30 ? n : null;
  }
  return null;
}

/** Unidades que SÍ traen al menos N plazas. Pickup y chico fuera. Sin el número, no se afirma. */
export function pickCarsWithMinSeats(
  cars: StockCar[],
  min: number,
): StockCar[] {
  return cars
    .filter((car) => {
      const group = carBodyGroup(car.typeBody);
      if (group === 'chico' || group === 'camioneta') {
        return false;
      }
      const seats = seatsOfCar(car.passengerCapacity);
      return seats != null && seats >= min;
    })
    .sort((a, b) => scoreSpace(b) - scoreSpace(a));
}

export function formatLargePassengerPedido(text: string): string {
  const seats = parsePassengerAsk(text);
  const van = VAN.test(text);
  const pedido = [
    van ? 'furgoneta / van' : '',
    seats ? `${seats} pasajeros` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return `PEDIDO DE ESPACIO / PASAJEROS
El cliente quiere un vehículo GRANDE para varias personas${pedido ? ` (${pedido})` : ''}.
Si no hay furgoneta ni esa cantidad de asientos, dilo primero.
Después ofrece SOLO los de más espacio del inventario (SUV/jeep, más pasajeros, 3 filas).
PROHIBIDO ofrecer carros chicos (sedán, hatchback).
PROHIBIDO ofrecer camioneta/pickup como si fuera furgoneta.
No inventes un modelo que no esté en la revisión. vehiculo null hasta que elija.`;
}

export function formatLargePassengerRevision(
  text: string,
  cars: StockCar[],
  includePrice = false,
): string {
  const header = formatLargePassengerPedido(text);
  if (cars.length === 0) {
    return `${header}
No hay en patio un vehículo grande de pasajeros. Diló. No ofrezcas un carro chico ni una camioneta.`;
  }
  return `${header}
Estos son los de MÁS ESPACIO en patio. Nómbralos y pregunta cuál le interesa. No elijas uno solo ni mandes fotos todavía.
${cars.map((car) => describeUnit(car, includePrice)).join('\n')}`;
}
