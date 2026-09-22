import { LeadAnalysisPatch } from './lead.types';

const TEMPERATURES = new Set(['frio', 'tibio', 'caliente']);

function asBudgetText(value: unknown): string | null {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function asDateOnly(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function asTimeOnly(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }
  return null;
}

function asTimestamptz(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const ms = Date.parse(trimmed);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** Solo manda a leads columnas que Postgres acepta; omite basura del LLM. */
export function sanitizeLeadAnalysisPatch(
  patch: LeadAnalysisPatch,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (patch.budget !== undefined) {
    out.budget = asBudgetText(patch.budget);
  }
  if (patch.temperature !== undefined) {
    if (TEMPERATURES.has(String(patch.temperature))) {
      out.temperature = patch.temperature;
    }
  }
  if (patch.behavior_signals !== undefined) {
    out.behavior_signals = patch.behavior_signals;
  }
  if (patch.cedula !== undefined && patch.cedula.trim()) {
    out.cedula = patch.cedula.trim();
  }

  const day = asDateOnly(patch.day_detected);
  if (day) {
    out.day_detected = day;
  }
  const hour = asTimeOnly(patch.hour_detected);
  if (hour) {
    out.hour_detected = hour;
  }
  const when = asTimestamptz(patch.time_reference);
  if (when) {
    out.time_reference = when;
  }

  return out;
}

export function coerceTradeInYear(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(String(value).replace(/\D/g, ''));
  if (!Number.isFinite(n)) {
    return null;
  }
  const year = Math.round(n);
  if (year < 1950 || year > 2100) {
    return null;
  }
  return year;
}
