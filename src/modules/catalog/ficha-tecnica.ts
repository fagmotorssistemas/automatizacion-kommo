import { StockCar } from './clasificar-filas';

const FILAS = /\b(?:filas?|pasajeros?|puestos|asientos|tercera\s+fila)\b/i;
const TECHO = /\b(?:techo|panor[aá]mic|sunroof|quemacocos?)\b/i;
const EQUIPO = [
  { topic: 'camara', pattern: /\b(?:c[aá]maras?|reversa|visi[oó]n\s+360)\b/i },
  { topic: 'pantalla', pattern: /\b(?:pantalla|android\s+auto|carplay)\b/i },
  { topic: 'cuero', pattern: /\b(?:cuero|piel)\b/i },
  { topic: 'airbags', pattern: /\b(?:airbags?|bolsas?\s+de\s+aire)\b/i },
  { topic: 'sensores', pattern: /\b(?:sensores?)\b/i },
];

/** Eso ya está en patio: no se investiga. */
const DATO_DE_PATIO =
  /\b(?:precio|valor|cu[oó]ta|entrada|cr[eé]dito|visita|direcci[oó]n|ubicaci[oó]n|fotos?|km|kilometr|placa|color|caja|manual|autom[aá]tic|transmisi[oó]n|4\s*x\s*[24]|tracci[oó]n)\b/i;

const PREGUNTA_DE_FICHA =
  /\b(?:tiene|trae|viene(?:\s+con)?|cuenta\s+con|es\s+de|son\s+de)\b/i;

export const SPEC_RESEARCH_PROMPT = `Investigás fichas técnicas de vehículos en la web. Solo respondes JSON.

Recibes el pedido del cliente y las filas reales de inventoryoracle (id, marca, modelo completo, año, versión, motor, tracción, puertas).
Investiga ESA fila: el modelo tal como viene (Montero Sport GLS AC 3.0 5p 4x4, o Montero 2.5, el que esté). No lo acortes a la familia. No uses otro modelo ni otro año.
Investiga exactamente lo que preguntó: filas, techo, cámara, cuero, airbags o el dato que pida. No cambies de tema.

Devuelve únicamente:
{"fichas":[{"id":"uuid","seguro":true,"dato":"texto corto del dato que confirma o niega el pedido"}]}

- seguro=true solo si la ficha técnica lo dice. Ese dato es un hecho. No escribas "tal vez", "podría" ni "aproximadamente".
- Si la ficha dice que sí tiene lo pedido, el dato lo afirma (ej. "7 pasajeros, 3 filas, tercera fila abatible").
- Si la ficha dice que no lo tiene, seguro=true igual y el dato lo niega (ej. "5 puestos, 2 filas").
- seguro=false y dato="no consta" solo si no aparece en ninguna ficha de ese modelo y año.
- No marques seguro=false en todos si encontraste la ficha de alguno.
- Investiga todas las unidades de la lista en esta misma respuesta. No dejes ninguna para después.
- Usa solo ids de la lista.`;

export type SpecFact = {
  id: string;
  seguro: boolean;
  dato: string;
};

function foldTopic(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 40);
}

/** Qué dato de ficha pidió. Null si es precio, km o algo que ya está en patio. */
export function specTopic(ask: string): string | null {
  if (!ask.trim() || DATO_DE_PATIO.test(ask)) {
    return null;
  }
  if (TECHO.test(ask)) {
    return 'techo';
  }
  for (const item of EQUIPO) {
    if (item.pattern.test(ask)) {
      return item.topic;
    }
  }
  if (FILAS.test(ask)) {
    return 'filas';
  }
  if (PREGUNTA_DE_FICHA.test(ask)) {
    return foldTopic(ask) || 'equipo';
  }
  return null;
}

export function specCacheKey(
  model: string,
  year: number | null,
  topic: string,
): string {
  const name = model.toLowerCase().replace(/\s+/g, ' ').trim();
  return `${name}|${year ?? 0}|${topic}`;
}

/**
 * Solo lo que la búsqueda dijo de cada id.
 * Null si no respondió o no trajo fichas: eso no se guarda ni se afirma.
 * Un id que no vino no se convierte en «no consta».
 */
export function factsFromResearch(
  raw: string | null,
  ids: string[],
): SpecFact[] | null {
  if (raw == null) {
    return null;
  }
  const parsed = parseSpecFacts(raw, ids);
  return parsed.length > 0 ? parsed : null;
}

/** Unidades a las que les falta el dato en el patio. */
export function carsForSpecLookup(ask: string, cars: StockCar[]): StockCar[] {
  const topic = specTopic(ask);
  if (!topic) {
    return [];
  }
  if (topic === 'filas') {
    return cars.filter((car) => !String(car.passengerCapacity ?? '').trim());
  }
  return cars;
}

/** Un dato de ficha que el patio no trae. */
export function needsSpecLookup(ask: string, cars: StockCar[]): boolean {
  return carsForSpecLookup(ask, cars).length > 0;
}

export function parseSpecFacts(
  raw: string | null,
  allowedIds: string[],
): SpecFact[] {
  if (!raw?.trim() || allowedIds.length === 0) {
    return [];
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }

  const fichas = (parsed as { fichas?: unknown }).fichas;
  if (!Array.isArray(fichas)) {
    return [];
  }

  const allowed = new Set(allowedIds);
  const facts: SpecFact[] = [];
  for (const row of fichas) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const id = String((row as { id?: unknown }).id ?? '');
    const dato = String((row as { dato?: unknown }).dato ?? '').trim();
    const seguro = (row as { seguro?: unknown }).seguro === true;
    if (!allowed.has(id) || facts.some((fact) => fact.id === id)) {
      continue;
    }
    const confirmed = seguro && dato.length > 0 && !/^no consta\b/i.test(dato);
    facts.push({
      id,
      seguro: confirmed,
      dato: confirmed ? dato : 'no consta',
    });
  }
  return facts;
}

/** Lo que el agente puede decir como hecho, y lo que no debe afirmar. */
export function formatSpecNotes(facts: SpecFact[]): string {
  if (facts.length === 0) {
    return '';
  }
  const sure = facts.filter((fact) => fact.seguro);
  const missing = facts.filter((fact) => !fact.seguro);
  const lines: string[] = [];
  lines.push(
    'La investigación de todas las unidades ya terminó. Un solo mensaje. No digas primero que no tienes el dato y después que sí.',
  );
  if (sure.length > 0) {
    lines.push(
      'FICHAS TÉCNICAS CONFIRMADAS. Dilo como hecho. No lo pongas en duda:',
    );
    for (const fact of sure) {
      lines.push(`- ${fact.id}: ${fact.dato}`);
    }
  }
  if (missing.length > 0) {
    lines.push(
      `De estos no tenemos el dato (no consta en la ficha de ese modelo y año). Dílo en este mismo mensaje, sin negar a los confirmados: ${missing.map((fact) => fact.id).join(', ')}.`,
    );
  }
  return lines.join('\n');
}
