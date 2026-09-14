import { CtwaMatch } from './lead.types';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** If18 mira `matched`; el texto del anuncio viene en `ad_headline`. */
export function parseCtwaMatch(data: unknown): CtwaMatch {
  const row = Array.isArray(data) ? asRecord(data[0]) : asRecord(data);
  if (!row) {
    return { matched: false, adHeadline: null, capturedAt: null };
  }

  const headline = row.ad_headline;
  const capturedAt = row.captured_at;
  return {
    matched: row.matched === true,
    adHeadline: typeof headline === 'string' && headline.trim() ? headline : null,
    capturedAt:
      typeof capturedAt === 'string' && capturedAt.trim() ? capturedAt : null,
  };
}
