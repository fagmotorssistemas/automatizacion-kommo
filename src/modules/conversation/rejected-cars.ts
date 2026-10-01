import {
  modelFamily,
  rowMentionsFamily,
  type StockCar,
} from '../catalog/clasificar-filas';
import {
  detectNamedModelAsk,
  type VehicleLexicon,
} from './vehicle-brand';

export type RejectedCars = {
  ids: string[];
  families: string[];
};

export const EMPTY_REJECTED: RejectedCars = { ids: [], families: [] };

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export function parseRejectedCars(
  raw: string | null | undefined,
): RejectedCars {
  if (!raw?.trim()) {
    return { ids: [], families: [] };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<RejectedCars>;
    const ids = Array.isArray(parsed.ids)
      ? parsed.ids.filter((id): id is string => typeof id === 'string')
      : [];
    const families = Array.isArray(parsed.families)
      ? parsed.families.filter(
          (family): family is string => typeof family === 'string',
        )
      : [];
    return {
      ids: uniqueStrings(ids),
      families: uniqueStrings(families.map((family) => modelFamily(family))),
    };
  } catch {
    return { ids: [], families: [] };
  }
}

export function serializeRejectedCars(rejected: RejectedCars): string {
  return JSON.stringify({
    ids: uniqueStrings(rejected.ids),
    families: uniqueStrings(rejected.families.map((family) => modelFamily(family))),
  });
}

export function sameRejected(a: RejectedCars, b: RejectedCars): boolean {
  const norm = (value: RejectedCars) =>
    JSON.stringify({
      ids: [...value.ids].sort(),
      families: [...value.families].sort(),
    });
  return norm(a) === norm(b);
}

export function excludeRejected<T extends { id: string; model: string }>(
  cars: T[],
  rejected: RejectedCars | null | undefined,
): T[] {
  if (
    !rejected ||
    (rejected.ids.length === 0 && rejected.families.length === 0)
  ) {
    return cars;
  }
  const ids = new Set(rejected.ids);
  return cars.filter((car) => {
    if (ids.has(car.id)) {
      return false;
    }
    return !rejected.families.some((family) =>
      rowMentionsFamily(car.model, family),
    );
  });
}

export function mergeRejected(
  base: RejectedCars,
  extra: RejectedCars,
): RejectedCars {
  return {
    ids: uniqueStrings([...base.ids, ...extra.ids]),
    families: uniqueStrings([...base.families, ...extra.families]),
  };
}

export function familyOfRejectLabel(
  label: string,
  lexicon: VehicleLexicon,
): string | null {
  const asked = detectNamedModelAsk(label, lexicon);
  const family = asked?.family || modelFamily(label);
  return family || null;
}

export function carsMatchingRejectLabel(
  label: string,
  cars: StockCar[],
  lexicon: VehicleLexicon,
): StockCar[] {
  const family = familyOfRejectLabel(label, lexicon);
  if (!family) {
    return [];
  }
  return cars.filter((car) => rowMentionsFamily(car.model, family));
}

export function restoreNamedFamily(
  rejected: RejectedCars,
  family: string,
  cars: StockCar[],
): RejectedCars {
  const wanted = modelFamily(family);
  if (!wanted) {
    return rejected;
  }
  const dropIds = new Set(
    cars
      .filter((car) => rowMentionsFamily(car.model, wanted))
      .map((car) => car.id),
  );
  return {
    ids: rejected.ids.filter((id) => !dropIds.has(id)),
    families: rejected.families.filter((item) => item !== wanted),
  };
}
