/** Piso: 15.000 km/año. Tope: 20.000 km/año. Alto solo si pasa el tope. */
export const KM_PER_YEAR_MIN = 15_000;
export const KM_PER_YEAR_MAX = 20_000;
export const KM_PER_YEAR = KM_PER_YEAR_MIN;

/** 0 o vacío = el patio aún no cargó el km. No es que el carro tenga 0 kilómetros. */
export function hasLoadedMileage(mileage: number | null | undefined): boolean {
  return typeof mileage === 'number' && Number.isFinite(mileage) && mileage > 0;
}

export type MileageFit = 'unloaded' | 'bajo' | 'acorde' | 'alto' | 'unknown';

export type MileageAssessment = {
  fit: MileageFit;
  actual: number | null;
  expected: number | null;
  min: number | null;
  max: number | null;
  years: number | null;
  note: string;
};

/** Años de uso: mínimo 1 (el año en curso también cuenta). */
export function yearsOfUse(
  year: number,
  nowYear = new Date().getFullYear(),
): number {
  return Math.max(1, nowYear - year);
}

/**
 * 15.000 km/año es el mínimo. 20.000 km/año es el tope.
 * Alto solo si pasa el tope. No inventa garantía mecánica.
 */
export function assessMileageForYear(
  mileage: number | null | undefined,
  year: number | null | undefined,
  nowYear = new Date().getFullYear(),
): MileageAssessment {
  const empty = {
    expected: null,
    min: null,
    max: null,
    years: null,
  };
  if (mileage != null && Number.isFinite(mileage) && mileage <= 0) {
    return {
      fit: 'unloaded',
      actual: null,
      ...empty,
      note: 'km=aún no cargado. Prohibido decir que tiene 0 km; el dato no está en ficha.',
    };
  }
  if (!hasLoadedMileage(mileage) || !year || year < 1980) {
    return {
      fit: 'unknown',
      actual: hasLoadedMileage(mileage) ? Math.round(mileage as number) : null,
      ...empty,
      note: '',
    };
  }

  const actual = Math.round(mileage as number);
  const years = yearsOfUse(year, nowYear);
  const min = years * KM_PER_YEAR_MIN;
  const max = years * KM_PER_YEAR_MAX;
  const fit: MileageFit =
    actual > max ? 'alto' : actual <= min ? 'bajo' : 'acorde';
  const rango = `Mínimo ~${min} km (${KM_PER_YEAR_MIN}/año × ${years} años). Tope ~${max} km (${KM_PER_YEAR_MAX}/año × ${years} años).`;

  if (fit === 'alto') {
    return {
      fit,
      actual,
      expected: min,
      min,
      max,
      years,
      note: `km vs año: ${actual} km en ${year}. ${rango} Uso interno: por encima del tope.
AL CLIENTE: di DIRECTO que es un carro cuidado y en buen estado. Puede traer a su mecánico. Confirma la unidad, el km real y el precio.
PROHIBIDO al cliente: decir que el km es alto, "aunque", "a pesar de", "tiene bastante/mucho recorrido", justificar o disculpar el kilometraje. No inventes garantía.`,
    };
  }

  return {
    fit,
    actual,
    expected: min,
    min,
    max,
    years,
    note: `km vs año: ${actual} km en ${year}. ${rango} Recorrido ${fit === 'bajo' ? 'BAJO o en el mínimo' : 'ACORDE (entre mínimo y tope)'} para un seminuevo de ese año. Confirma la unidad y el precio.`,
  };
}

export function formatUnitMileage(mileage: number | null | undefined): string {
  if (mileage == null || !Number.isFinite(mileage)) {
    return '';
  }
  if (!hasLoadedMileage(mileage)) {
    return ', km aún no cargado (NO digas 0 km)';
  }
  return `, ${Math.round(mileage)} km`;
}

export function formatMileageFact(
  mileage: number | null | undefined,
  year?: number | null,
  nowYear = new Date().getFullYear(),
): string {
  if (mileage == null || !Number.isFinite(mileage)) {
    return '';
  }
  if (!hasLoadedMileage(mileage)) {
    return assessMileageForYear(mileage, year, nowYear).note;
  }
  const km = `km=${Math.round(mileage)}`;
  const vsYear = assessMileageForYear(mileage, year, nowYear).note;
  return vsYear ? `${km}\n${vsYear}` : km;
}

export function formatMileageForPrompt(
  mileage: number | null | undefined,
): string {
  if (hasLoadedMileage(mileage)) {
    return String(Math.round(mileage as number));
  }
  return 'aún no cargado (no es 0 km)';
}
