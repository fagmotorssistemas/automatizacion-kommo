import { hasLoadedMileage } from '../catalog/mileage';
import {
  rowMentionsFamily,
  textMentionsModel,
  type StockCar,
} from '../catalog/clasificar-filas';
import { detectGearbox, gearboxOf } from './gearbox';
import {
  COLORS,
  colorMatches,
  detectColorInText,
  detectNamedModelAsk,
  detectYearInText,
  type VehicleLexicon,
} from './vehicle-brand';
import { emptyLexicon } from './fuzzy-vehicle-name';
import { wantsPhotosOfListed } from './listed-photos';

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

export type ResolucionPresentada =
  | { kind: 'una'; car: StockCar }
  | { kind: 'varias'; cars: StockCar[] }
  | { kind: 'ninguna' };

const ORDINALES: { n: number; pattern: RegExp }[] = [
  { n: 1, pattern: /\b(?:la|el)\s+primer[oa]s?\b|\b(?:la|el)\s+1(?:era?|er)?\b/i },
  { n: 2, pattern: /\b(?:la|el)\s+segund[oa]s?\b|\b(?:la|el)\s+2(?:da?)?\b/i },
  { n: 3, pattern: /\b(?:la|el)\s+tercer[oa]s?\b|\b(?:la|el)\s+3(?:era?)?\b/i },
  { n: 4, pattern: /\b(?:la|el)\s+cuart[oa]s?\b|\b(?:la|el)\s+4(?:ta?)?\b/i },
  { n: 5, pattern: /\b(?:la|el)\s+quint[oa]s?\b|\b(?:la|el)\s+5(?:ta?)?\b/i },
];

const REFERENCIA_VAGA =
  /\b(?:es[ae]|ese|esta|este)\b|\b(?:la|el)\s+mism[oa](?:\s+(?:unidad|carro|auto|vehiculo))?\b|\bprecios?\b/i;

function familiaDicha(
  text: string,
  lexicon: VehicleLexicon,
): string | null {
  const named = detectNamedModelAsk(text, lexicon);
  if (!named?.family) {
    return null;
  }
  if (/^(?:19|20)\d{2}$/.test(named.family)) {
    return null;
  }
  return named.family;
}

function carsDeTurno(
  turno: UnidadPresentada[],
  byId: Map<string, StockCar>,
): StockCar[] {
  return turno
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((row) => byId.get(row.inventory_id))
    .filter((car): car is StockCar => Boolean(car));
}

/** Unidades de esa familia ya mostradas o halladas por el tool. */
export function unidadesDeFamiliaEnContexto(
  family: string | null | undefined,
  pools: StockCar[][],
): StockCar[] {
  const wanted = family?.trim();
  if (!wanted) {
    return [];
  }
  const seen = new Set<string>();
  const hits: StockCar[] = [];
  for (const pool of pools) {
    for (const car of pool) {
      if (seen.has(car.id) || !rowMentionsFamily(car.model, wanted)) {
        continue;
      }
      seen.add(car.id);
      hits.push(car);
    }
  }
  return hits;
}

export function carsDesdePresentadas(
  turnos: UnidadPresentada[][],
  byId: Map<string, StockCar>,
): StockCar[] {
  const seen = new Set<string>();
  const cars: StockCar[] = [];
  for (const turno of turnos) {
    for (const car of carsDeTurno(turno, byId)) {
      if (seen.has(car.id)) {
        continue;
      }
      seen.add(car.id);
      cars.push(car);
    }
  }
  return cars;
}

function detectOrdinal(text: string): number | null {
  for (const row of ORDINALES) {
    if (row.pattern.test(text)) {
      return row.n;
    }
  }
  return null;
}

function filtrarPorDatos(
  cars: StockCar[],
  text: string,
  lexicon: VehicleLexicon,
): StockCar[] {
  const year = detectYearInText(text);
  const color = detectColorInText(text);
  const box = detectGearbox(text, lexicon);
  const family = familiaDicha(text, lexicon);
  let next = cars;
  let used = false;
  if (year != null) {
    next = next.filter((car) => car.year === year);
    used = true;
  }
  if (color) {
    next = next.filter((car) => colorMatches(car.color, color));
    used = true;
  }
  if (box) {
    next = next.filter((car) => gearboxOf(car) === box);
    used = true;
  }
  if (family) {
    next = next.filter((car) => rowMentionsFamily(car.model, family));
    used = true;
  }
  const byKm = next.filter((car) => textoMencionaKm(text, car.mileage));
  if (byKm.length > 0) {
    next = byKm;
    used = true;
  }
  return used ? next : [];
}

function esReferenciaVaga(text: string): boolean {
  return REFERENCIA_VAGA.test(text) || wantsPhotosOfListed(text);
}

/** Referencia a algo ya mostrado, sin un modelo nuevo fuera del registro. */
export function esReferenciaAMostradas(
  text: string,
  turnos: UnidadPresentada[][],
  byId: Map<string, StockCar>,
  lexicon: VehicleLexicon = emptyLexicon(),
): boolean {
  const cars = carsDesdePresentadas(turnos, byId);
  if (cars.length === 0) {
    return false;
  }
  const family = familiaDicha(text, lexicon);
  if (family && !cars.some((car) => rowMentionsFamily(car.model, family))) {
    return false;
  }
  if (detectOrdinal(text) != null) {
    return true;
  }
  if (esReferenciaVaga(text)) {
    return true;
  }
  if (detectYearInText(text) != null || detectColorInText(text)) {
    return true;
  }
  if (detectGearbox(text, lexicon)) {
    return true;
  }
  if (family) {
    return true;
  }
  return cars.some((car) => textoMencionaKm(text, car.mileage));
}

/**
 * Resuelve contra el último turno presentado y, si no alcanza, los 2 anteriores.
 * No parsea la prosa del bot.
 */
export function resolverReferenciaPresentadas(input: {
  text: string;
  turnos: UnidadPresentada[][];
  byId: Map<string, StockCar>;
  lexicon?: VehicleLexicon;
}): ResolucionPresentada {
  const lexicon = input.lexicon ?? emptyLexicon();
  if (
    !esReferenciaAMostradas(input.text, input.turnos, input.byId, lexicon)
  ) {
    return { kind: 'ninguna' };
  }
  const ordinal = detectOrdinal(input.text);
  for (const turno of input.turnos) {
    const cars = carsDeTurno(turno, input.byId);
    if (cars.length === 0) {
      continue;
    }
    if (ordinal != null) {
      const hit = cars[ordinal - 1];
      return hit ? { kind: 'una', car: hit } : { kind: 'ninguna' };
    }
    const filtered = filtrarPorDatos(cars, input.text, lexicon);
    if (filtered.length === 1) {
      return { kind: 'una', car: filtered[0] };
    }
    if (filtered.length > 1) {
      return { kind: 'varias', cars: filtered };
    }
    if (cars.length === 1) {
      return { kind: 'una', car: cars[0] };
    }
    if (esReferenciaVaga(input.text)) {
      return { kind: 'varias', cars };
    }
  }
  return { kind: 'ninguna' };
}
