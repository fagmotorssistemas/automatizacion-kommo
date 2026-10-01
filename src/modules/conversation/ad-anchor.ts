import {
  describeUnit,
  formatNamedUnits,
  type StockCar,
} from '../catalog/clasificar-filas';
import {
  kindFromTypeBody,
  type VehicleKind,
} from './vehicle-kind';

const FEATURED_KINDS: VehicleKind[] = [
  'suv',
  'camioneta',
  'sedan',
  'hatchback',
];

export function pickFeaturedAdUnits(cars: StockCar[], max = 3): StockCar[] {
  const priced = [...cars]
    .filter((car) => car.price != null && car.price > 0)
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  const picked: StockCar[] = [];
  const seen = new Set<string>();
  for (const kind of FEATURED_KINDS) {
    const hit = priced.find(
      (car) => kindFromTypeBody(car.typeBody) === kind && !seen.has(car.id),
    );
    if (!hit) {
      continue;
    }
    picked.push(hit);
    seen.add(hit.id);
    if (picked.length >= max) {
      return picked;
    }
  }
  return picked;
}

export function formatFeaturedAdRevision(cars: StockCar[]): {
  text: string;
  holdVehicle: boolean;
  sendId: null;
  listedUnits: StockCar[];
  switchedModel: true;
} {
  const named = formatNamedUnits(cars, true);
  return {
    text: `ANUNCIO GENÉRICO (sin unidad del catálogo). Muestra estas ${cars.length} unidades de tipos distintos CON precio. UNA pregunta: presupuesto o tipo. PROHIBIDO una pregunta seca de modelo.
${named.text}`,
    holdVehicle: true,
    sendId: null,
    listedUnits: named.listedUnits,
    switchedModel: true,
  };
}

export function formatAnchoredAdRevision(car: StockCar): {
  text: string;
  holdVehicle: boolean;
  sendId: string;
  unitPrice: number | null;
  listedUnits: StockCar[];
  switchedModel: true;
} {
  const named = formatNamedUnits([car], false);
  return {
    text: `ANUNCIO: clicó esta unidad. Preséntala AHORA (ficha, sin precio). PROHIBIDO preguntar qué carro le interesa.
${named.text}
En meta.vehiculo.inventory_id pon exactamente "${car.id}".`,
    holdVehicle: false,
    sendId: car.id,
    unitPrice:
      car.price && car.price > 0 ? Math.round(car.price) : named.unitPrice,
    listedUnits: [car],
    switchedModel: true,
  };
}

function foldKm(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/,/g, '');
}

/** Km que el cliente da para buscar unidad ("el auto que tiene 25000km"). */
export function askedMileageKm(text: string): number | null {
  const n = foldKm(text);
  const match = n.match(/(\d{4,7})\s*(?:km|kilometros?)\b/);
  if (!match) {
    return null;
  }
  const km = Number(match[1]);
  return Number.isFinite(km) && km >= 1000 ? km : null;
}

export function carsNearMileage(
  cars: StockCar[],
  km: number,
  slack = 0.05,
): StockCar[] {
  if (km <= 0) {
    return [];
  }
  return cars.filter((car) => {
    if (car.mileage == null || car.mileage <= 0) {
      return false;
    }
    return Math.abs(car.mileage - km) / km <= slack;
  });
}

export function formatMileageAnchorRevision(car: StockCar): {
  text: string;
  holdVehicle: boolean;
  sendId: string;
  unitPrice: number | null;
  listedUnits: StockCar[];
  switchedModel: true;
  anclaPorKm: true;
} {
  const named = formatNamedUnits([car], true);
  return {
    text: `El cliente pidió el auto de ~${car.mileage} km. Hay UNA unidad que calza. Preséntala.
${describeUnit(car, true)}
En meta.vehiculo.inventory_id pon exactamente "${car.id}".`,
    holdVehicle: false,
    sendId: car.id,
    unitPrice: named.unitPrice,
    listedUnits: [car],
    switchedModel: true,
    anclaPorKm: true,
  };
}
