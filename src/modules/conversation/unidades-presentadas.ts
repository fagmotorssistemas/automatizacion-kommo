import { hasLoadedMileage } from '../catalog/mileage';
import {
  textMentionsModel,
  type StockCar,
} from '../catalog/clasificar-filas';
import {
  COLORS,
  colorMatches,
} from './vehicle-brand';

export const MAX_TURNOS_PRESENTADAS = 3;

export type ComoPresentada = 'ficha' | 'lista' | 'alternativa';

export type UnidadPresentada = {
  inventory_id: string;
  orden: number;
  como: ComoPresentada;
};

export type CandidatoPresentada = {
  car: StockCar;
  como: ComoPresentada;
};

function foldText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function textoMencionaAnio(
  text: string,
  year: number | null | undefined,
): boolean {
  if (year == null || !Number.isFinite(year)) {
    return false;
  }
  return new RegExp(`\\b${year}\\b`).test(text);
}

function textoMencionaColor(
  text: string,
  color: string | null | undefined,
): boolean {
  if (!color?.trim()) {
    return false;
  }
  const folded = foldText(text);
  for (const row of COLORS) {
    if (!colorMatches(color, row.name)) {
      continue;
    }
    row.pattern.lastIndex = 0;
    if (row.pattern.test(folded)) {
      return true;
    }
  }
  const raw = foldText(color.trim());
  return raw.length >= 3 && folded.includes(raw);
}

function textoMencionaKm(
  text: string,
  mileage: number | null | undefined,
): boolean {
  if (!hasLoadedMileage(mileage)) {
    return false;
  }
  const km = String(Math.round(mileage as number));
  return text.includes(km) || text.replace(/[.,\s]/g, '').includes(km);
}

/** Familia en el texto y al menos un dato propio (año, color, km). No parsea la lista. */
export function unidadMencionadaEnTexto(car: StockCar, text: string): boolean {
  if (!textMentionsModel(text, car.model)) {
    return false;
  }
  return (
    textoMencionaAnio(text, car.year) ||
    textoMencionaColor(text, car.color) ||
    textoMencionaKm(text, car.mileage)
  );
}

export function candidatosDadosAlLlm(input: {
  sendId?: string | null;
  listedUnits?: StockCar[];
  contextOrigin?: 'alternativas_caja';
  contextIds?: string[];
  toolCars?: StockCar[];
  byId: Map<string, StockCar>;
}): CandidatoPresentada[] {
  const rows: CandidatoPresentada[] = [];
  const seen = new Set<string>();
  const add = (id: string | null | undefined, como: ComoPresentada) => {
    const clean = id?.trim();
    if (!clean || seen.has(clean)) {
      return;
    }
    const car = input.byId.get(clean);
    if (!car) {
      return;
    }
    seen.add(clean);
    rows.push({ car, como });
  };

  const listed = input.listedUnits ?? [];
  const listedComo: ComoPresentada =
    input.contextOrigin === 'alternativas_caja' ||
    (input.contextIds?.length ?? 0) > 0
      ? 'alternativa'
      : listed.length > 1
        ? 'lista'
        : 'ficha';
  for (const car of listed) {
    add(car.id, listedComo);
  }

  if (input.contextOrigin === 'alternativas_caja') {
    for (const id of input.contextIds ?? []) {
      add(id, 'alternativa');
    }
  }

  add(input.sendId, listedComo === 'lista' ? 'lista' : 'ficha');

  const toolCars = input.toolCars ?? [];
  const toolComo: ComoPresentada = toolCars.length > 1 ? 'lista' : 'ficha';
  for (const car of toolCars) {
    add(car.id, toolComo);
  }

  return rows;
}

/** De las unidades que el turno le dio al LLM, las que el texto final menciona. */
export function calcularUnidadesPresentadas(
  candidatos: CandidatoPresentada[],
  texto: string,
): UnidadPresentada[] {
  const presentadas: UnidadPresentada[] = [];
  for (const row of candidatos) {
    if (!unidadMencionadaEnTexto(row.car, texto)) {
      continue;
    }
    presentadas.push({
      inventory_id: row.car.id,
      orden: presentadas.length + 1,
      como: row.como,
    });
  }
  return presentadas;
}

function isComoPresentada(value: unknown): value is ComoPresentada {
  return value === 'ficha' || value === 'lista' || value === 'alternativa';
}

function parseUnidadPresentada(raw: unknown): UnidadPresentada | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const row = raw as Partial<UnidadPresentada>;
  const inventoryId =
    typeof row.inventory_id === 'string' ? row.inventory_id.trim() : '';
  const orden = Number(row.orden);
  if (!inventoryId || !Number.isFinite(orden) || orden < 1) {
    return null;
  }
  if (!isComoPresentada(row.como)) {
    return null;
  }
  return { inventory_id: inventoryId, orden, como: row.como };
}

export function parseRegistroPresentadas(
  raw: string | null | undefined,
): UnidadPresentada[][] {
  if (!raw?.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((turno) => {
        if (!Array.isArray(turno)) {
          return [];
        }
        return turno
          .map(parseUnidadPresentada)
          .filter((row): row is UnidadPresentada => Boolean(row));
      })
      .filter((turno) => turno.length > 0)
      .slice(0, MAX_TURNOS_PRESENTADAS);
  } catch {
    return [];
  }
}

export function serializeRegistroPresentadas(
  turnos: UnidadPresentada[][],
): string {
  return JSON.stringify(turnos.slice(0, MAX_TURNOS_PRESENTADAS));
}

export function appendTurnoPresentadas(
  prev: UnidadPresentada[][],
  turno: UnidadPresentada[],
): UnidadPresentada[][] {
  if (turno.length === 0) {
    return prev.slice(0, MAX_TURNOS_PRESENTADAS);
  }
  return [turno, ...prev].slice(0, MAX_TURNOS_PRESENTADAS);
}
