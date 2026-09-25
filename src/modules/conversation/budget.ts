import {
  formatNamedUnits,
  preferCurrentYears,
  type StockCar,
} from '../catalog/clasificar-filas';
import {
  kindFromTypeBody,
  matchesVehicleKind,
  type VehicleKind,
} from './vehicle-kind';
import type { Gearbox } from './gearbox';
import { gearboxOf } from './gearbox';

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function carFitsBudget(
  car: { price?: number | null },
  budget: number,
): boolean {
  return car.price != null && car.price > 0 && car.price <= budget;
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
    return preferCurrentYears([...pool].sort(byPrice).slice(0, 3));
  }
  return preferCurrentYears(picked.slice(0, 6));
}

export function carsMatchingAskInBudget(
  cars: StockCar[],
  budget: number,
  opts?: {
    exceptId?: string | null;
    kind?: VehicleKind | null;
    gearbox?: Gearbox | null;
  },
): StockCar[] {
  return cars.filter((car) => {
    if (opts?.exceptId && car.id === opts.exceptId) {
      return false;
    }
    if (!carFitsBudget(car, budget)) {
      return false;
    }
    if (opts?.kind && !matchesVehicleKind(car.typeBody, opts.kind)) {
      return false;
    }
    if (opts?.gearbox && gearboxOf(car) !== opts.gearbox) {
      return false;
    }
    return true;
  });
}

export const BUDGET_FINANCING_ASK =
  'Recuerde que lo puede financiar para un carro que se acomode a lo que más le guste. ¿Le ayudamos con crédito o prefiere de contado?';

export const BUDGET_PICK_SHOWN =
  '¿Cuál de las unidades que le mostramos le gusta más?';

export function replyAskedBudgetFinancing(text: string): boolean {
  const n = fold(text);
  return /puede financiar/.test(n) && /se acomode/.test(n);
}

export function historyAskedBudgetFinancing(
  history?: { role: string; content: string }[],
): boolean {
  return (history ?? []).some(
    (item) => item.role === 'assistant' && replyAskedBudgetFinancing(item.content),
  );
}

export function replyAskedWhichShown(text: string): boolean {
  const n = fold(text);
  return /cual de las unidades/.test(n) && /le gusta/.test(n);
}

export function historyAskedWhichShown(
  history?: { role: string; content: string }[],
): boolean {
  return (history ?? []).some(
    (item) => item.role === 'assistant' && replyAskedWhichShown(item.content),
  );
}

export function shouldAskBudgetFinancing(input: {
  listedBudgetNow: boolean;
  history?: { role: string; content: string }[];
  reply?: string;
}): boolean {
  if (!input.listedBudgetNow) {
    return false;
  }
  if (historyAskedBudgetFinancing(input.history)) {
    return false;
  }
  if (input.reply && replyAskedBudgetFinancing(input.reply)) {
    return false;
  }
  return true;
}

export function shouldAskWhichShown(input: {
  prefiereContado: boolean;
  alreadyPicked: boolean;
  history?: { role: string; content: string }[];
  reply?: string;
}): boolean {
  if (!input.prefiereContado || input.alreadyPicked) {
    return false;
  }
  if (!historyAskedBudgetFinancing(input.history)) {
    return false;
  }
  if (historyAskedWhichShown(input.history)) {
    return false;
  }
  if (input.reply && replyAskedWhichShown(input.reply)) {
    return false;
  }
  return true;
}

function appendBudgetLine(text: string, extra: string): string {
  const body = text.trim();
  if (!body) {
    return extra;
  }
  if (fold(body).includes(fold(extra).slice(0, 32))) {
    return body;
  }
  return `${body}\n\n${extra}`;
}

export function appendBudgetFinancingAsk(text: string): string {
  return appendBudgetLine(text, BUDGET_FINANCING_ASK);
}

export function appendBudgetPickShown(text: string): string {
  return appendBudgetLine(text, BUDGET_PICK_SHOWN);
}

export function formatBudgetRevision(input: {
  budget: number;
  cars: StockCar[];
  over?: { family?: string | null; price?: number | null };
}): { text: string; holdVehicle: boolean; sendId: string | null } {
  const over =
    input.over?.price && input.over.price > input.budget
      ? `El ${input.over.family ?? 'que ya vieron'} ($${Math.round(input.over.price)}) queda por encima de este contado. Dilo. No armes cuota.`
      : '';
  const header = `PRESUPUESTO DE CONTADO: $${input.budget}. Busca SUV, hatchback y sedán en patio. Prohibido decir que no hay un tipo si hay uno abajo. Prohibido ofrecer carros por encima del tope como "cercanos". No sueltes precio si no lo pidió. Lista las unidades. El sistema pregunta si quieren crédito o contado. PROHIBIDO armar cuota. PROHIBIDO pregunta de visita en este turno.`;
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
