import { StockCar } from './clasificar-filas';

const FILAS = /\b(?:filas?|pasajeros?|puestos|asientos)\b/i;
const TECHO = /\b(?:techo|panor[aá]mic)/i;

export const SPEC_RESEARCH_PROMPT = `Investigás fichas técnicas de vehículos en la web. Solo respondes JSON.

Recibes el pedido del cliente y las unidades reales de una marca (id, modelo, año).
Busca la ficha técnica de ESE modelo y ESE año (fabricante o catálogo). No uses otro modelo ni otro año para rellenar.

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

export function specTopic(ask: string): 'filas' | 'techo' | null {
  if (TECHO.test(ask)) {
    return 'techo';
  }
  if (FILAS.test(ask)) {
    return 'filas';
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

/** Unidades a las que les falta el dato en el patio. El techo no tiene columna. */
export function carsForSpecLookup(ask: string, cars: StockCar[]): StockCar[] {
  if (TECHO.test(ask)) {
    return cars;
  }
  if (!FILAS.test(ask)) {
    return [];
  }
  return cars.filter((car) => !String(car.passengerCapacity ?? '').trim());
}

/** Filas, pasajeros o techo, y la ficha del patio no trae ese dato. */
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
