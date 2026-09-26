import {
  stripListedPriceAmounts,
  stripUnloadedPriceClaim,
} from '../conversation/strip-unsolicited-price';

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

export function historySaidMileageCare(
  history?: { role: string; content: string }[],
): boolean {
  return (history ?? []).some(
    (item) =>
      item.role === 'assistant' &&
      /mec[aá]nico|carro cuidado y en buen estado/i.test(item.content),
  );
}

export function stripRepeatedMileageCare(text: string): string {
  return text
    .replace(/\s*Puede traer a su mec[aá]nico[^.]*\./gi, '')
    .replace(/\s*Es un carro cuidado y en buen estado[^.]*\./gi, '')
    .replace(/\s*con [\d.,]+\s*km reales\.?/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .trim();
}

function priceIsInText(text: string, amount: number): boolean {
  const raw = String(amount);
  const comma = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const dot = raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return text.includes(raw) || text.includes(comma) || text.includes(dot);
}

/** Quita el discurso del km cuando el cliente pidió el precio, no el recorrido. */
export function stripMileageCareOnPriceAsk(text: string): string {
  return text
    .replace(/[,;]?\s*el kilometraje es acorde[^.]*\./gi, '.')
    .replace(/[,;]?\s*es un carro cuidado y en buen estado[^.]*\./gi, '.')
    .replace(/[,;]?\s*puede traer a su mec[aá]nico[^.]*\./gi, '.')
    .replace(/\s+\./g, '.')
    .replace(/\.\s*\./g, '.')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Si preguntó el precio y el modelo no lo escribió, se pone el del patio.
 * La ciudad u otra frase del mismo mensaje se queda.
 */
function dropDanglingAnd(text: string): string {
  return text
    .replace(/,\s*y\s*$/i, '.')
    .replace(/\s+y\s*$/i, '.')
    .replace(/\.\s*\./g, '.')
    .trim();
}

export function ensureListedPrice(text: string, price: number): string {
  const amount = Math.round(price);
  const body = dropDanglingAnd(
    stripMileageCareOnPriceAsk(stripUnloadedPriceClaim(text)),
  );
  if (!Number.isFinite(amount) || amount <= 0) {
    return body;
  }
  if (priceIsInText(body, amount)) {
    return body;
  }
  const clean = dropDanglingAnd(stripListedPriceAmounts(body));
  const lead = `El precio es $${amount.toLocaleString('en-US')}.`;
  return clean ? `${lead} ${clean}` : lead;
}

export function formatMileageFact(
  mileage: number | null | undefined,
  year?: number | null,
  nowYear = new Date().getFullYear(),
  options?: { skipClientCare?: boolean },
): string {
  if (mileage == null || !Number.isFinite(mileage)) {
    return '';
  }
  if (!hasLoadedMileage(mileage)) {
    return assessMileageForYear(mileage, year, nowYear).note;
  }
  const km = `km=${Math.round(mileage)}`;
  const vsYear = assessMileageForYear(mileage, year, nowYear).note;
  const note =
    options?.skipClientCare && vsYear
      ? vsYear
          .replace(/\n?AL CLIENTE:[\s\S]*$/i, '')
          .replace(/\n?Puede traer a su mec[aá]nico[^\n]*/gi, '')
          .trim()
      : vsYear;
  return note ? `${km}\n${note}` : km;
}

export function formatMileageForPrompt(
  mileage: number | null | undefined,
): string {
  if (hasLoadedMileage(mileage)) {
    return String(Math.round(mileage as number));
  }
  return 'aún no cargado (no es 0 km)';
}
