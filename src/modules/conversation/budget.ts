import {
  formatNamedUnits,
  type StockCar,
} from '../catalog/clasificar-filas';
import { kindFromTypeBody, type VehicleKind } from './vehicle-kind';
import { textAsksForCredit } from '../intelligence/parse-resumen';

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Entrada / cuota / plazo: no es tope de contado. */
function looksLikeDownPayment(text: string): boolean {
  return textAsksForCredit(text);
}

function parseBudgetAmount(text: string): number | null {
  const n = fold(text);
  const mil = n.match(/\$?\s*(\d{1,3}(?:[.,]\d{3})*|\d+)\s*mil\b/);
  if (mil) {
    const raw = mil[1].replace(/[.,]/g, '');
    const value = Number(raw);
    return Number.isFinite(value) ? value * (raw.length <= 3 ? 1000 : 1) : null;
  }
  const dotted = n.match(
    /\$\s*(\d{1,3}(?:[.\s]\d{3})+|\d{4,6})(?:[.,]\d{2})?|(\d{1,3}(?:\.\d{3})+)\s*\$/,
  );
  if (dotted) {
    const raw = (dotted[1] ?? dotted[2]).replace(/[.\s]/g, '');
    const value = Number(raw);
    return Number.isFinite(value) && value >= 1000 ? value : null;
  }
  const plain = n.match(/\$\s*(\d{4,6})\b|\b(\d{4,6})\s*\$/);
  if (plain) {
    const value = Number(plain[1] ?? plain[2]);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

/**
 * Dinero que tiene para el carro de contado.
 * “Dispongo de 10.000$” / “por 10.000$” no es entrada.
 */
export function detectCashBudget(text: string): number | null {
  if (!text.trim() || looksLikeDownPayment(text)) {
    return null;
  }
  const n = fold(text);
  const talksBudget =
    /\b(?:dispongo|cuento con|presupuesto|hasta|maximo)\b/.test(n) ||
    /\b(?:tengo|tenemos)\s+\$?\s*\d/.test(n) ||
    /\b(?:que|cual(?:es)?)\s+vehicul/.test(n) ||
    /\bpor\s+\$?\s*\d/.test(n);
  if (!talksBudget) {
    return null;
  }
  return parseBudgetAmount(text);
}

export function carsInBudget(
  cars: StockCar[],
  budget: number,
  exceptId?: string | null,
): StockCar[] {
  const pool = cars.filter(
    (car) =>
      car.id !== exceptId &&
      car.price != null &&
      car.price > 0 &&
      car.price <= budget,
  );
  const kinds: VehicleKind[] = ['suv', 'hatchback', 'sedan'];
  const picked: StockCar[] = [];
  const seen = new Set<string>();
  const byPrice = (a: StockCar, b: StockCar) =>
    (a.price ?? 0) - (b.price ?? 0);
  for (const kind of kinds) {
    for (const car of pool
      .filter((item) => kindFromTypeBody(item.typeBody) === kind)
      .sort(byPrice)
      .slice(0, 2)) {
      if (!seen.has(car.id)) {
        seen.add(car.id);
        picked.push(car);
      }
    }
  }
  if (picked.length === 0) {
    return [...pool].sort(byPrice).slice(0, 3);
  }
  return picked.slice(0, 6);
}

export function formatBudgetRevision(input: {
  budget: number;
  cars: StockCar[];
  over?: { family?: string | null; price?: number | null };
}): { text: string; holdVehicle: boolean; sendId: string | null } {
  const over =
    input.over?.price && input.over.price > input.budget
      ? `El ${input.over.family ?? 'que ya vieron'} ($${Math.round(input.over.price)}) queda por encima de este contado. DESPUÉS de listar, puede ofrecer financiamiento de ESA unidad. No armes cuota ahora: no pidió crédito.`
      : '';
  const header = `PRESUPUESTO DE CONTADO: $${input.budget}. Busca SUV, hatchback y sedán en patio. Prohibido decir que no hay un tipo si hay uno abajo. Prohibido ofrecer carros por encima del tope como "cercanos". No sueltes precio si no lo pidió.`;
  if (input.cars.length === 0) {
    return {
      text: `${header}
No hay unidades de patio en ese tope. Dilo claro. ${over} vehiculo null.`,
      holdVehicle: true,
      sendId: null,
    };
  }
  const named = formatNamedUnits(input.cars, false);
  return {
    text: `${header}
${over}
${named.text}`,
    holdVehicle: true,
    sendId: null,
  };
}
