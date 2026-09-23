import { detectNamedModelAsk } from '../conversation/vehicle-brand';
import { emptyLexicon, type VehicleLexicon } from '../conversation/fuzzy-vehicle-name';
import { textMentionsModel, type StockCar } from './clasificar-filas';
import type { VehicleKind } from '../conversation/vehicle-kind';

export const INVENTORY_TOP_K = 3;
export const INVENTORY_NAMED_TOP_K = 8;

export function inventorySearchPlan(
  query: string,
  tipo: VehicleKind | null,
  marca: string | null,
  lexicon: VehicleLexicon = emptyLexicon(),
): { tipo: VehicleKind | null; marca: string | null; named: boolean } {
  const asked = detectNamedModelAsk(query, lexicon);
  if (asked) {
    return { tipo: null, marca: asked.brand || null, named: true };
  }
  return { tipo, marca, named: false };
}

export function matchRowsMentionFamily(raw: string, family: string): boolean {
  if (!family || raw.trim() === '[]') {
    return false;
  }
  return textMentionsModel(raw, family);
}

function matchRowFields(row: unknown): {
  id: string;
  meta: Record<string, unknown>;
  rec: Record<string, unknown>;
} | null {
  if (!row || typeof row !== 'object') {
    return null;
  }
  const rec = row as Record<string, unknown>;
  const meta =
    rec.metadata && typeof rec.metadata === 'object'
      ? (rec.metadata as Record<string, unknown>)
      : {};
  const id = rec.id ?? rec.inventory_id ?? meta.inventory_id ?? meta.id;
  if (!id) {
    return null;
  }
  return { id: String(id), meta, rec };
}

export function idsFromMatchJson(raw: string): string[] {
  try {
    const rows = JSON.parse(raw) as unknown;
    if (!Array.isArray(rows)) {
      return [];
    }
    return rows.flatMap((row) => {
      const parsed = matchRowFields(row);
      return parsed ? [parsed.id] : [];
    });
  } catch {
    return [];
  }
}

/** El RPC devuelve content + metadata; no hay que tirarlo si listByBrand no lo trajo. */
export function carsFromMatchJson(raw: string): StockCar[] {
  try {
    const rows = JSON.parse(raw) as unknown;
    if (!Array.isArray(rows)) {
      return [];
    }
    return rows.flatMap((row) => {
      const parsed = matchRowFields(row);
      if (!parsed) {
        return [];
      }
      const { id, meta, rec } = parsed;
      const model = String(meta.model ?? rec.model ?? rec.content ?? '').trim();
      if (!model) {
        return [];
      }
      const typeBody = meta.type ?? meta.type_body ?? rec.type_body ?? null;
      const year = meta.year ?? rec.year;
      const price = meta.price ?? rec.price;
      return [
        {
          id,
          brand: String(meta.brand ?? rec.brand ?? ''),
          model,
          year: year == null || year === '' ? null : Number(year),
          price: price == null || price === '' ? null : Number(price),
          typeBody: typeBody == null ? null : String(typeBody),
          color: meta.color == null ? null : String(meta.color),
          plateShort:
            meta.plate_short == null ? null : String(meta.plate_short),
        },
      ];
    });
  } catch {
    return [];
  }
}
