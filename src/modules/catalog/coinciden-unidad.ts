import {
  detectAskedCab,
  detectAskedDrive,
  textMentionsModel,
  unitCab,
  unitDrive,
  type StockCar,
} from './clasificar-filas';
import { detectGearbox, gearboxOf } from '../conversation/gearbox';
import {
  colorMatches,
  detectBrand,
  detectColorInText,
  detectNamedModelAsk,
  type VehicleLexicon,
} from '../conversation/vehicle-brand';

export type HechosUnidad = {
  year: number | null;
  color: string | null;
  price: number | null;
  gearbox: 'manual' | 'automatica' | null;
  drive: string | null;
  cab: 'cs' | 'cd' | null;
  engine: string | null;
  family: string | null;
  brand: string | null;
};

/** Cuántos datos dijo. Con uno solo, este camino no corre. */
export function contarHechos(hechos: HechosUnidad): number {
  return [
    hechos.year,
    hechos.color,
    hechos.price,
    hechos.gearbox,
    hechos.drive,
    hechos.cab,
    hechos.engine,
    hechos.family,
    hechos.brand,
  ].filter((value) => value != null).length;
}

/** El monto que señaló, no un año. 22,800 y 22.800 son 22800. */
export function precioDicho(text: string): number | null {
  const separated = [...text.matchAll(/\b(\d{1,3}(?:[.,]\d{3})+)\b/g)]
    .map((match) => Number(match[1].replace(/[.,]/g, '')))
    .filter((amount) => amount >= 1000 && amount <= 200000);
  if (separated.length > 0) {
    return separated[separated.length - 1];
  }
  const plain = [...text.matchAll(/\b(\d{4,6})\b/g)]
    .map((match) => Number(match[1]))
    .filter(
      (amount) =>
        amount >= 3000 &&
        amount <= 90000 &&
        !(amount >= 1990 && amount <= 2035),
    );
  return plain.length > 0 ? plain[plain.length - 1] : null;
}

export function hechosDesdeTexto(
  text: string,
  year: number | null,
  lexicon: VehicleLexicon,
): HechosUnidad {
  const named = detectNamedModelAsk(text, lexicon);
  const family =
    named?.family && String(year ?? '') !== named.family ? named.family : null;
  const engine = text.match(/\b(\d\.\d)\b/);
  return {
    year,
    color: detectColorInText(text),
    price: precioDicho(text),
    gearbox: detectGearbox(text, lexicon),
    drive: detectAskedDrive(text),
    cab: detectAskedCab(text),
    engine: engine ? engine[1] : null,
    family,
    brand: detectBrand(text, lexicon),
  };
}

function coincide(
  car: StockCar,
  hechos: HechosUnidad,
): { puntos: number; distinto: string[] } {
  let puntos = 0;
  const distinto: string[] = [];
  const sumar = (label: string, ok: boolean) => {
    if (ok) {
      puntos += 1;
    } else {
      distinto.push(label);
    }
  };
  if (hechos.brand) {
    sumar('marca', car.brand.trim().toLowerCase() === hechos.brand);
  }
  if (hechos.family) {
    sumar('modelo', textMentionsModel(car.model, hechos.family));
  }
  if (hechos.year != null) {
    sumar('año', car.year === hechos.year);
  }
  if (hechos.price != null) {
    sumar('precio', Math.round(car.price ?? 0) === hechos.price);
  }
  if (hechos.color) {
    sumar('color', colorMatches(car.color, hechos.color));
  }
  if (hechos.gearbox) {
    sumar('transmisión', gearboxOf(car) === hechos.gearbox);
  }
  if (hechos.drive) {
    sumar('tracción', unitDrive(car) === hechos.drive);
  }
  if (hechos.cab) {
    sumar('cabina', unitCab(car) === hechos.cab);
  }
  if (hechos.engine) {
    sumar('motor', car.model.includes(hechos.engine));
  }
  return { puntos, distinto };
}

/** La unidad con más datos de los que dijo. Cero puntos no elige. */
export function coincidenUnidad(
  cars: StockCar[],
  hechos: HechosUnidad,
): { cars: StockCar[]; puntos: number; distinto: string[] } | null {
  if (contarHechos(hechos) < 2 || cars.length === 0) {
    return null;
  }
  let best = 0;
  let chosen: { car: StockCar; distinto: string[] }[] = [];
  for (const car of cars) {
    const score = coincide(car, hechos);
    if (score.puntos === 0 || score.puntos < best) {
      continue;
    }
    if (score.puntos > best) {
      best = score.puntos;
      chosen = [];
    }
    chosen.push({ car, distinto: score.distinto });
  }
  if (chosen.length === 0) {
    return null;
  }
  return {
    cars: chosen.map((item) => item.car),
    puntos: best,
    distinto: chosen[0].distinto,
  };
}
