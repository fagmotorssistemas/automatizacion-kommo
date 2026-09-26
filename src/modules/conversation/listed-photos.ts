import {
  detectAskedCab,
  detectAskedDrive,
  modelFamily,
  prettyFamily,
  textMentionsModel,
  type CabCode,
  type StockCar,
  unitCab,
  unitCaja,
  unitDrive,
} from '../catalog/clasificar-filas';
import { asksForPhotos } from '../outbound/should-send-photos';
import {
  colorMatches,
  detectColorInText,
  detectTrimInText,
  detectYearInText,
  modelHasTrim,
} from './vehicle-brand';
import { detectGearbox } from './gearbox';
import type { VehicleLexicon } from './fuzzy-vehicle-name';

export type PhotoQueueItem = {
  inventoryId: string;
  label: string;
};

const MAX_PHOTO_PACKS = 6;

/** El bot ya enumeró varias unidades: 1) 2) 3), o un párrafo con año y km. */
export function looksLikeUnitList(text: string): boolean {
  const marks = text.match(/\b[1-9]\)/g) ?? [];
  if (marks.length >= 2) {
    return true;
  }
  return proseUnitItems(text).length >= 2;
}

/**
 * Párrafo sin números: "Couper ... 2012 con 60746 km, Tunland ... 2023 con 113692 km".
 * Si el año/modelo va en el encabezado ("4 Sportage 2019: blanco…, plateado automático…"),
 * cada color/caja/km hereda ese encabezado.
 * La coma de miles (60,746) no parte la unidad.
 */
function proseUnitItems(text: string): string[] {
  const head = text.split('?')[0] ?? text;
  const colon = head.lastIndexOf(':');
  const prefix = colon >= 0 ? head.slice(0, colon).trim() : '';
  const body = colon >= 0 ? head.slice(colon + 1) : head;
  const yearInPrefix = /\b(?:19|20)\d{2}\b/.test(prefix);
  return body
    .split(/,(?!\d)\s+|\s+y\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .filter((chunk) => {
      const hasYear = /\b(?:19|20)\d{2}\b/.test(chunk) || yearInPrefix;
      const hasKm =
        /\d{3,7}\s*km\b/i.test(chunk) || /\bkilometraje\b/i.test(chunk);
      const hasColorBox = Boolean(
        detectColorInText(chunk) && detectGearbox(chunk),
      );
      return hasYear && (hasKm || hasColorBox);
    })
    .map((chunk) => (prefix ? `${prefix} ${chunk}` : chunk));
}

function listItems(text: string): string[] {
  const marks = text.match(/\b[1-9]\)/g) ?? [];
  if (marks.length >= 2) {
    return text.split(/\b[1-9]\)/).slice(1);
  }
  return proseUnitItems(text);
}

/** Cola de fotos solo si el último mensaje del bot ya listó unidades. */
export function historyHasUnitList(
  history: { role: string; content: string }[],
): boolean {
  const last =
    [...history]
      .reverse()
      .find((item) => item.role === 'assistant' && item.content)?.content ?? '';
  return looksLikeUnitList(last);
}

function itemHasKm(item: string, mileage: number | null | undefined): boolean {
  if (mileage == null || !Number.isFinite(mileage) || mileage <= 0) {
    return false;
  }
  const km = String(Math.round(mileage));
  return item.includes(km) || item.replace(/[.,\s]/g, '').includes(km);
}

/** Una viñeta del listado: solo esa unidad, no otra del mismo modelo en patio. */
function matchListedItem(item: string, cars: StockCar[]): StockCar | null {
  const mentioned = cars.filter((car) => textMentionsModel(item, car.model));
  if (mentioned.length === 0) {
    return null;
  }
  const folded = item.toLowerCase();
  const hits = mentioned.filter((car) => {
    const yearHit =
      car.year != null && new RegExp(`\\b${car.year}\\b`).test(item);
    const colorHit = Boolean(
      car.color && folded.includes(car.color.trim().toLowerCase()),
    );
    const kmHit = itemHasKm(item, car.mileage);
    return yearHit || colorHit || kmHit;
  });
  if (hits.length === 0) {
    return null;
  }
  const tight = hits.filter((car) => {
    const yearHit =
      car.year != null && new RegExp(`\\b${car.year}\\b`).test(item);
    const colorHit = Boolean(
      car.color && folded.includes(car.color.trim().toLowerCase()),
    );
    const kmHit = itemHasKm(item, car.mileage);
    return (yearHit && (colorHit || kmHit)) || kmHit;
  });
  const pool = tight.length > 0 ? tight : hits;
  if (pool.length === 1) {
    return pool[0];
  }
  const byKm = pool.filter((car) => itemHasKm(item, car.mileage));
  return byKm.length === 1 ? byKm[0] : null;
}

/** Solo las que el bot enumeró (1) 2) 3)). Nunca otra del patio. */
export function carsNamedInList(text: string, cars: StockCar[]): StockCar[] {
  if (!looksLikeUnitList(text)) {
    return [];
  }
  const items = listItems(text);
  const found: StockCar[] = [];
  const used = new Set<string>();
  for (const item of items) {
    const hit = matchListedItem(
      item,
      cars.filter((car) => !used.has(car.id)),
    );
    if (hit) {
      found.push(hit);
      used.add(hit.id);
    }
  }
  return found;
}

export function lastListedUnits(
  history: { role: string; content: string }[],
  cars: StockCar[],
): StockCar[] {
  const last = [...history]
    .reverse()
    .find((item) => item.role === 'assistant' && item.content);
  if (!last) {
    return [];
  }
  return carsNamedInList(last.content, cars);
}

/** Pidió otro modelo, no una de las que ya se nombraron. */
export function askedOutsideListed(
  family: string | null | undefined,
  listed: StockCar[],
): boolean {
  if (!family || listed.length === 0) {
    return false;
  }
  const wanted = modelFamily(family);
  return !listed.some(
    (car) =>
      textMentionsModel(car.model, family) ||
      modelFamily(car.model) === wanted,
  );
}

/** Sportage 2019 rojo — para el WhatsApp, no la ficha. */
export function shortUnitLabel(car: StockCar): string {
  const year = car.year ? ` ${car.year}` : '';
  const color = car.color ? ` ${car.color.trim()}` : '';
  return `${prettyFamily(car.model)}${year}${color}`.replace(/\s+/g, ' ').trim();
}

export function asksForAllListed(text: string): boolean {
  return /\b(?:tod[ao]s?(?:itas?)?|las\s+(?:dos|tres|cuatro|cinco|\d+)|de\s+tod)\b/i.test(
    text,
  );
}

/**
 * Cola de varios carros solo si pidió las fotos del listado o de todas.
 * Un “sí / ok / por favor” no manda los paquetes de cada unidad.
 */
export function wantsPhotosOfListed(text: string): boolean {
  const folded = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!folded || /\bno\s+(?:gracias|por ahora|quiero|me las)\b/.test(folded)) {
    return false;
  }
  return asksForPhotos(text) || asksForAllListed(text);
}

/** Un color, año, caja o versión que deja una sola de las ya listadas. */
export function pickListedUnit(
  cars: StockCar[],
  text: string,
  lexicon?: VehicleLexicon,
  known?: { cab?: CabCode | null },
): StockCar | null {
  const year = detectYearInText(text);
  const color = detectColorInText(text);
  const trim = detectTrimInText(text);
  const box = detectGearbox(text, lexicon);
  const cab = detectAskedCab(text) ?? known?.cab ?? null;
  const drive = detectAskedDrive(text);
  if (!year && !color && !trim && !box && !cab && !drive) {
    return null;
  }
  const hits = cars.filter((car) => {
    if (year != null && car.year !== year) {
      return false;
    }
    if (color && (!car.color || !colorMatches(car.color, color))) {
      return false;
    }
    if (trim && !modelHasTrim(car.model, trim)) {
      return false;
    }
    if (box && unitCaja(car) !== (box === 'automatica' ? 'automática' : 'manual')) {
      return false;
    }
    if (cab && unitCab(car) !== cab) {
      return false;
    }
    if (drive && unitDrive(car) !== drive) {
      return false;
    }
    return true;
  });
  return hits.length === 1 ? hits[0] : null;
}

export function toPhotoQueue(cars: StockCar[]): PhotoQueueItem[] {
  return cars.slice(0, MAX_PHOTO_PACKS).map((car) => ({
    inventoryId: car.id,
    label: shortUnitLabel(car),
  }));
}

export function formatListedPhotoQueue(cars: StockCar[]): {
  text: string;
  holdVehicle: boolean;
  sendId: null;
  photoQueue: PhotoQueueItem[];
  switchedModel: true;
} {
  return {
    text: `El cliente pidió las fotos de las ${cars.length} unidades YA listadas. PROHIBIDO volver a pegar las fichas. Una frase: le mando las fotos una por una.`,
    holdVehicle: true,
    sendId: null,
    photoQueue: toPhotoQueue(cars),
    switchedModel: true,
  };
}
