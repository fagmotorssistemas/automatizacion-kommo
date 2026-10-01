import {
  describeUnit,
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

export const OPEN_BUDGET_SLACK = 1.1;

export type OpenBudgetPick = {
  cars: StockCar[];
  overBudget: StockCar | null;
};

/** Hasta 4 en el tope (caro primero) y como mucho 1 que se pasa un poco. */
export function carsForOpenBudget(
  cars: StockCar[],
  budget: number,
  opts?: {
    kind?: VehicleKind | null;
    exceptId?: string | null;
    exceptIds?: string[];
  },
): OpenBudgetPick {
  const excluded = new Set(
    [opts?.exceptId, ...(opts?.exceptIds ?? [])].filter(
      (id): id is string => Boolean(id),
    ),
  );
  const pool = cars.filter((car) => {
    if (excluded.has(car.id)) {
      return false;
    }
    if (car.price == null || car.price <= 0) {
      return false;
    }
    if (opts?.kind && !matchesVehicleKind(car.typeBody, opts.kind)) {
      return false;
    }
    return true;
  });
  const under = pool
    .filter((car) => (car.price ?? 0) <= budget)
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    .slice(0, 4);
  const overBudget =
    pool
      .filter(
        (car) =>
          (car.price ?? 0) > budget &&
          (car.price ?? 0) <= budget * OPEN_BUDGET_SLACK,
      )
      .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0] ?? null;
  return { cars: under, overBudget };
}

export function formatOpenBudgetRevision(input: {
  budget: number;
  cars: StockCar[];
  overBudget?: StockCar | null;
}): {
  text: string;
  holdVehicle: boolean;
  sendId: string | null;
  listedUnits: StockCar[];
} {
  const listed = input.overBudget
    ? [...input.cars, input.overBudget]
    : input.cars;
  const header = `PRESUPUESTO DE CONTADO: $${input.budget}. Lista estas unidades CON su $. Pregunta cuál de ESTAS le interesa. PROHIBIDO preguntar qué carro le interesa como si no hubiera opciones. PROHIBIDO armar cuota. PROHIBIDO visita en este turno.`;
  if (input.cars.length === 0 && !input.overBudget) {
    return {
      text: `${header}
No hay unidades de patio en ese tope. Dilo claro. vehiculo null.`,
      holdVehicle: true,
      sendId: null,
      listedUnits: [],
    };
  }
  const named = formatNamedUnits(input.cars, true);
  const over = input.overBudget
    ? `Esta se pasa un poco del presupuesto (hasta 10%): ${describeUnit(input.overBudget, true)}. Dilo así. No la ventes como si cupiera.`
    : '';
  return {
    text: `${header}
${named.text}
${over}`.trim(),
    holdVehicle: true,
    sendId: null,
    listedUnits: listed,
  };
}

const KIND_LABEL: Record<VehicleKind, string> = {
  suv: 'SUV',
  camioneta: 'camioneta',
  sedan: 'sedán',
  hatchback: 'hatchback',
};

/** Pide ver el patio sin tope ni tipo: rangos por tipo, no “qué carro”. */
export function patioKindPriceSummary(cars: StockCar[]): {
  text: string;
  holdVehicle: boolean;
  sendId: string | null;
} {
  const kinds: VehicleKind[] = ['hatchback', 'sedan', 'suv', 'camioneta'];
  const lines: string[] = [];
  for (const kind of kinds) {
    const priced = cars
      .filter(
        (car) =>
          matchesVehicleKind(car.typeBody, kind) &&
          car.price != null &&
          car.price > 0,
      )
      .map((car) => car.price as number);
    if (priced.length === 0) {
      continue;
    }
    const min = Math.round(Math.min(...priced));
    const max = Math.round(Math.max(...priced));
    lines.push(
      max === min
        ? `${KIND_LABEL[kind]} desde $${min}`
        : `${KIND_LABEL[kind]} desde $${min} hasta $${max}`,
    );
  }
  const body =
    lines.length > 0
      ? lines.join('. ')
      : 'Hay unidades en patio; nombra los tipos que sí hay y su rango de $.';
  return {
    text: `CATÁLOGO POR TIPO (pidió ver qué hay, sin tope ni tipo). Di este resumen corto: ${body}. UNA pregunta: presupuesto o tipo (SUV, sedán, hatchback, camioneta). PROHIBIDO una pregunta seca de modelo. PROHIBIDO inventar una unidad. vehiculo null.`,
    holdVehicle: true,
    sendId: null,
  };
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
