import {
  detectBrand,
  detectNamedModelAsk,
  isDriveFamily,
} from './vehicle-brand';
import { emptyLexicon, type VehicleLexicon } from './fuzzy-vehicle-name';

export const TOMA_SLOTS = [
  'marca',
  'modelo',
  'anio',
  'km',
  'color',
  'placa',
  'fotos',
  'monto',
] as const;

export type TomaSlot = (typeof TOMA_SLOTS)[number];

export type TomaChecklist = {
  have: Partial<Record<TomaSlot, string>>;
  pending: TomaSlot[];
};

const SLOT_LABEL: Record<TomaSlot, string> = {
  marca: 'marca',
  modelo: 'modelo exacto',
  anio: 'año',
  km: 'kilometraje',
  color: 'color',
  placa: 'primera letra de la placa',
  fotos: 'fotos',
  monto: 'monto que espera',
};

const ALIAS: Record<string, TomaSlot> = {
  marca: 'marca',
  brand: 'marca',
  modelo: 'modelo',
  model: 'modelo',
  anio: 'anio',
  ano: 'anio',
  year: 'anio',
  km: 'km',
  kilometraje: 'km',
  kilometros: 'km',
  color: 'color',
  placa: 'placa',
  letra: 'placa',
  plate: 'placa',
  foto: 'fotos',
  fotos: 'fotos',
  monto: 'monto',
  valor: 'monto',
  esperado: 'monto',
};

const COLORS =
  /\b(blanc[oa]s?|negr[oa]s?|roj[oa]s?|azules?|plomos?|grises?|platead[oa]s?|verdes?|beiges?|dorad[oa]s?|vinos?)\b/i;

const COLOR_ONLY =
  /^(blanc[oa]s?|negr[oa]s?|roj[oa]s?|azules?|plomos?|grises?|platead[oa]s?|verdes?|beiges?|dorad[oa]s?|vinos?)$/i;

/** El analizador nombra el SUYO. Solo se descarta si el valor es otro dato (año, color, km), no si falta en patio. */
function isVehicleIdentity(value: string): boolean {
  const text = value.trim();
  if (!text || /^no$/i.test(text)) {
    return false;
  }
  const folded = fold(text);
  if (/^(?:19|20)\d{2}$/.test(folded)) {
    return false;
  }
  if (COLOR_ONLY.test(folded)) {
    return false;
  }
  if (/^\d/.test(folded) && /\b(?:mil|km|klm)/i.test(folded)) {
    return false;
  }
  if (/^\d+(?:[.,]\d+)?$/.test(folded)) {
    return false;
  }
  if (isDriveFamily(folded)) {
    return false;
  }
  if (asSlot(folded)) {
    return false;
  }
  return /[\p{L}]/u.test(text);
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function asSlot(raw: string): TomaSlot | null {
  const key = fold(raw).replace(/\s+/g, '');
  if (key.includes('placa') || key.includes('letra')) {
    return 'placa';
  }
  if (key.includes('foto')) {
    return 'fotos';
  }
  if (key.includes('monto') || key.includes('valor') || key.includes('esper')) {
    return 'monto';
  }
  if (key.includes('kilometr') || key === 'km') {
    return 'km';
  }
  if (key.includes('anio') || key.includes('ano') || key === 'year') {
    return 'anio';
  }
  return ALIAS[key] ?? null;
}

function lineOf(resumen: string, name: string): string | null {
  const match = resumen.match(new RegExp(`${name}:\\s*(.+?)(?:\\n|$)`, 'i'));
  if (!match) {
    return null;
  }
  const value = match[1].trim();
  if (!value || /^no$/i.test(value)) {
    return null;
  }
  return value;
}

function parseSlotList(text: string): TomaSlot[] {
  const found: TomaSlot[] = [];
  for (const part of text.split(/[,;]/)) {
    const slot = asSlot(part);
    if (slot && !found.includes(slot)) {
      found.push(slot);
    }
  }
  return found;
}

function parseHaveLabeled(text: string): Partial<Record<TomaSlot, string>> {
  const have: Partial<Record<TomaSlot, string>> = {};
  const pair = /(marca|modelo|a[nñ]o|year|km|kilometr\w*|color|placa|letra|fotos?|monto|valor)\s*=\s*([^;,\n]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = pair.exec(text)) !== null) {
    const slot = asSlot(match[1]);
    const value = match[2].trim();
    if (slot && value && !/^no$/i.test(value)) {
      have[slot] = value;
    }
  }
  return have;
}

function parseHaveLoose(text: string): Partial<Record<TomaSlot, string>> {
  const have: Partial<Record<TomaSlot, string>> = {};
  let rest = text;
  const year = rest.match(/\b((?:19|20)\d{2})\b/);
  if (year) {
    have.anio = year[1];
    rest = rest.replace(year[0], ' ');
  }
  const kmMil = rest.match(/\bx?(\d+)\s*mil(?:es)?\b/i);
  const kmNum = rest.match(/\b(\d{1,3}(?:[.,]\d{3})+|\d{4,})\b/);
  if (kmMil) {
    have.km = `${kmMil[1]} mil`;
    rest = rest.replace(kmMil[0], ' ');
  } else if (kmNum) {
    have.km = kmNum[1];
    rest = rest.replace(kmNum[0], ' ');
  }
  const color = rest.match(COLORS);
  if (color) {
    have.color = color[1];
  }
  return have;
}

function applyLexiconNames(
  text: string,
  have: Partial<Record<TomaSlot, string>>,
  lexicon: VehicleLexicon,
): void {
  const brand = detectBrand(text, lexicon);
  if (brand && !have.marca) {
    have.marca = brand;
  }
  const named = detectNamedModelAsk(text, lexicon);
  if (
    named?.family &&
    !isDriveFamily(named.family) &&
    !/^(?:19|20)\d{2}$/.test(named.family) &&
    !have.modelo
  ) {
    have.modelo = named.family;
    if (named.brand && !have.marca) {
      have.marca = named.brand;
    }
  }
}

export function parseHaveFacts(
  text: string,
  lexicon: VehicleLexicon = emptyLexicon(),
): Partial<Record<TomaSlot, string>> {
  const have: Partial<Record<TomaSlot, string>> = {};
  applyLexiconNames(text, have, lexicon);
  const labeled = parseHaveLabeled(text);
  const loose = parseHaveLoose(text);
  for (const slot of TOMA_SLOTS) {
    if (slot === 'marca' || slot === 'modelo') {
      if (labeled[slot] && isVehicleIdentity(labeled[slot])) {
        have[slot] = labeled[slot];
      }
      continue;
    }
    if (labeled[slot]) {
      have[slot] = labeled[slot];
    } else if (!have[slot] && loose[slot]) {
      have[slot] = loose[slot];
    }
  }
  if (have.marca && !isVehicleIdentity(have.marca)) {
    delete have.marca;
  }
  if (have.modelo && !isVehicleIdentity(have.modelo)) {
    delete have.modelo;
  }
  return have;
}

export function emptyTomaChecklist(): TomaChecklist {
  return { have: {}, pending: [] };
}

export function missingTomaSlots(checklist: TomaChecklist): TomaSlot[] {
  const pending = new Set(checklist.pending);
  return TOMA_SLOTS.filter((slot) => !checklist.have[slot] && !pending.has(slot));
}

export function parseTomaChecklistFromResumen(
  resumen: string,
  lexicon: VehicleLexicon = emptyLexicon(),
): TomaChecklist | null {
  const ya = lineOf(resumen, 'toma\\s+ya');
  const pendiente = lineOf(resumen, 'toma\\s+pendiente');
  const falta = lineOf(resumen, 'toma\\s+falta');
  const ficha = lineOf(resumen, 'toma\\s+ficha');
  if (!ya && !pendiente && !falta && !ficha) {
    return null;
  }
  const have = {
    ...(ficha ? parseHaveFacts(ficha, lexicon) : {}),
    ...(ya ? parseHaveFacts(ya, lexicon) : {}),
  };
  return {
    have,
    pending: pendiente ? parseSlotList(pendiente) : [],
  };
}

export function mergeTomaChecklist(
  prev: TomaChecklist | null,
  next: TomaChecklist | null,
): TomaChecklist | null {
  if (!prev && !next) {
    return null;
  }
  const have = { ...(prev?.have ?? {}), ...(next?.have ?? {}) };
  const pending = [...(prev?.pending ?? [])];
  for (const slot of next?.pending ?? []) {
    if (!pending.includes(slot)) {
      pending.push(slot);
    }
  }
  return {
    have,
    pending: pending.filter((slot) => !have[slot]),
  };
}

function formatHave(have: Partial<Record<TomaSlot, string>>): string {
  const parts = TOMA_SLOTS.flatMap((slot) =>
    have[slot] ? [`${slot}=${have[slot]}`] : [],
  );
  return parts.join(', ') || 'nada aún';
}

export function formatTomaForResumen(checklist: TomaChecklist | null): string {
  if (!checklist) {
    return '';
  }
  const falta = missingTomaSlots(checklist);
  return `YA: ${formatHave(checklist.have)}
PENDIENTE: ${checklist.pending.join(', ') || 'nada'}
FALTA: ${falta.join(', ') || 'nada'}`;
}

export function formatTomaPedido(checklist: TomaChecklist | null): string {
  const base = `TOMA: nos está vendiendo SU vehículo. No busques ni ofrezcas uno igual. El avalúo lo define el patio, no inventes un valor.
Si además quiere comprar OTRO carro nuestro, ese sí se busca. Casa/terreno no es toma.`;
  if (!checklist) {
    return `${base}
Pide SOLO lo que falte, máximo 2 datos. No repitas lo que ya dijo. Si no tiene un dato (fotos, placa), queda pendiente: no lo vuelvas a pedir.`;
  }
  const falta = missingTomaSlots(checklist);
  const ask = falta.slice(0, 2).map((slot) => SLOT_LABEL[slot]);
  return `${base}

CHECKLIST TOMA (manda, no inventes):
YA (no los pidas ni recites de nuevo; un acuse corto basta): ${formatHave(checklist.have)}
PENDIENTE (dijo que no tiene o no puede ahora: PROHIBIDO volver a pedirlos): ${
    checklist.pending.map((slot) => SLOT_LABEL[slot]).join(', ') || 'nada'
  }
FALTA: ${falta.map((slot) => SLOT_LABEL[slot]).join(', ') || 'nada'}
Pide SOLO esto, máximo 2: ${ask.join(', ') || 'nada: confirma que con eso avanzamos al avalúo o a que lo traiga'}
Si ofrece traer el carro, reconócelo y sigue con lo que falte. PROHIBIDO repetir marca+color+año+km en cada turno.`;
}
