import {
  formatNamedUnits,
  preferCurrentYears,
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
  const bare = [...n.matchAll(/\b(\d{4,6})\b/g)]
    .map((match) => Number(match[1]))
    .find(
      (value) =>
        Number.isFinite(value) &&
        value >= 3000 &&
        (value < 1990 || value > 2035),
    );
  return bare ?? null;
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
    /\bpor\s+\$?\s*\d/.test(n) ||
    /\bunos?\b/.test(n) ||
    /\balrededor\b/.test(n) ||
    /\balgun(?:os)?\s+(?:auto|carro|vehiculo)/.test(n);
  if (!talksBudget) {
    return null;
  }
  return parseBudgetAmount(text);
}

/** Último tope de contado que el cliente dijo en el hilo. */
export function lastCashBudgetInTexts(texts: string[]): number | null {
  let budget: number | null = null;
  for (const text of texts) {
    const found = detectCashBudget(text);
    if (found) {
      budget = found;
    }
  }
  return budget;
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

export const BUDGET_FINANCING_ASK =
  'También disponemos de financiamiento. ¿Le gustaría que le ayudemos con crédito para llevarse el que más le guste, o prefiere de contado?';

export const BUDGET_PICK_SHOWN =
  '¿Cuál de las unidades que le mostramos le gusta más?';

export function replyAskedBudgetFinancing(text: string): boolean {
  const n = fold(text);
  return /disponemos de financiamiento/.test(n) && /prefiere de contado/.test(n);
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
