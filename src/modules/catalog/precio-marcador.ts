import { hasLoadedPrice } from '../conversation/strip-unsolicited-price';

export const FRASE_PRECIO_PENDIENTE =
  'el precio se lo confirmo en un momento';

export type PrecioClave = {
  clave: string;
  inventoryId: string;
  price: number | null;
};

export function clavePrecio(orden: number): string {
  return `u${orden}`;
}

export function asignarClavesPrecio(
  cars: Array<{ id: string; price?: number | null }>,
  desde = 1,
): PrecioClave[] {
  const seen = new Set<string>();
  const out: PrecioClave[] = [];
  let n = desde;
  for (const car of cars) {
    if (!car.id || seen.has(car.id)) {
      continue;
    }
    seen.add(car.id);
    out.push({
      clave: clavePrecio(n),
      inventoryId: car.id,
      price: hasLoadedPrice(car.price) ? Math.round(car.price as number) : null,
    });
    n += 1;
  }
  return out;
}

export function formatPrecioUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

/** Línea de ficha: el LLM copia el marcador; el $ entre paréntesis solo le dice si hay dato. */
export function etiquetaPrecioFicha(
  clave: string,
  price: number | null | undefined,
): string {
  const amount = hasLoadedPrice(price) ? Math.round(price as number) : null;
  return amount != null
    ? `precio={{precio:${clave}}} ($${amount})`
    : `precio={{precio:${clave}}} (aún no cargado)`;
}

export function notaEscribeMarcador(clave: string, pedirValor: boolean): string {
  if (pedirValor) {
    return `\nPidió el valor: escribe {{precio:${clave}}} de ESTA ficha. PROHIBIDO un monto a mano.`;
  }
  return `\nSi mencionas el precio, escribe {{precio:${clave}}}. PROHIBIDO un monto a mano.`;
}

export function lexicalizarPrecio(
  mensaje: string,
  claves: PrecioClave[],
): string {
  const byClave = new Map(
    claves.map((item) => [item.clave.toLowerCase(), item]),
  );
  return mensaje.replace(/\{\{\s*precio:([^}]+)\s*\}\}/gi, (_, raw: string) => {
    const hit = byClave.get(raw.trim().toLowerCase());
    if (hit && hasLoadedPrice(hit.price)) {
      return formatPrecioUsd(hit.price as number);
    }
    return FRASE_PRECIO_PENDIENTE;
  });
}

/** Nada con "{{" sale al cliente. */
export function cerrarMarcadores(mensaje: string): string {
  return mensaje
    .replace(/\{\{[^}]*\}\}/g, FRASE_PRECIO_PENDIENTE)
    .replace(/\{\{/g, '');
}

const MONTO_CONTADO =
  /\$\s*(?:\d{1,3}(?:[.,]\d{3})+|\d{4,6})(?:[.,]\d{2})?/g;

/** Cuota/entrada de financiamiento: no es precio de contado de una unidad. */
function montoEsFinanciamiento(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 40), index).toLowerCase();
  return /\b(?:cuota|mensual(?:es)?|entrada|financi\w*|inicial|plazo)\b/.test(
    before,
  );
}

export function detectarPrecioCrudo(
  mensaje: string,
  unidad: string | null,
): { dijo: string; unidad: string | null } | null {
  for (const match of mensaje.matchAll(MONTO_CONTADO)) {
    if (montoEsFinanciamiento(mensaje, match.index ?? 0)) {
      continue;
    }
    return { dijo: match[0].replace(/\s+/g, ''), unidad };
  }
  return null;
}

export function unirPrecioClaves(...grupos: PrecioClave[][]): PrecioClave[] {
  const seen = new Set<string>();
  const out: PrecioClave[] = [];
  for (const grupo of grupos) {
    for (const item of grupo) {
      if (seen.has(item.inventoryId)) {
        continue;
      }
      seen.add(item.inventoryId);
      out.push(item);
    }
  }
  return out;
}

export function marcarPreciosEnToolJson(
  raw: string,
  existentes: PrecioClave[] = [],
): { json: string; claves: PrecioClave[] } {
  let rows: unknown;
  try {
    rows = JSON.parse(raw);
  } catch {
    return { json: raw, claves: [] };
  }
  if (!Array.isArray(rows)) {
    return { json: raw, claves: [] };
  }
  const cars = rows
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null;
      }
      const rec = row as Record<string, unknown>;
      const id = String(rec.id ?? rec.inventory_id ?? '').trim();
      if (!id) {
        return null;
      }
      const price = Number(rec.price ?? rec.precio);
      return { id, price: Number.isFinite(price) ? price : null };
    })
    .filter((row): row is { id: string; price: number | null } => Boolean(row));
  const byId = new Map(existentes.map((item) => [item.inventoryId, item]));
  const claves = asignarClavesPrecio(
    cars.filter((car) => !byId.has(car.id)),
    existentes.length + 1,
  );
  for (const item of claves) {
    byId.set(item.inventoryId, item);
  }
  const marked = rows.map((row) => {
    if (!row || typeof row !== 'object') {
      return row;
    }
    const rec = { ...(row as Record<string, unknown>) };
    const id = String(rec.id ?? rec.inventory_id ?? '').trim();
    const clave = byId.get(id);
    if (!clave) {
      return rec;
    }
    rec.precio = etiquetaPrecioFicha(clave.clave, clave.price);
    delete rec.price;
    return rec;
  });
  return { json: JSON.stringify(marked), claves };
}
