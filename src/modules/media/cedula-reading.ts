import {
  extractCedula,
  formatCedulaPhotoMessage,
} from '../intelligence/extract-cedula';

export const CEDULA_UNREADABLE =
  'Envió foto de su cédula. No se pudo leer el número.';

const EMPTY = new Set([
  'null',
  'n/a',
  'na',
  'no legible',
  'no visible',
  'ilegible',
  'desconocido',
  'no identificado',
]);

export type CedulaReading = {
  numero: string;
  nombre: string | null;
  origen: string | null;
};

function cleanField(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return null;
  }
  const folded = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (EMPTY.has(folded)) {
    return null;
  }
  return trimmed;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    const value = JSON.parse(raw.slice(start, end + 1)) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Null si no hay un número de cédula válido. No inventa dígitos. */
export function parseCedulaReading(raw: string | null): CedulaReading | null {
  if (!raw?.trim()) {
    return null;
  }
  const record = parseJsonObject(raw);
  if (!record) {
    return null;
  }
  const digits = String(record.numero ?? record.cedula ?? record.ci ?? '').replace(
    /\D/g,
    '',
  );
  const numero = extractCedula(digits);
  if (!numero) {
    return null;
  }
  return {
    numero,
    nombre: cleanField(record.nombre),
    origen: cleanField(record.origen),
  };
}

export function formatCedulaPhotoText(raw: string | null): string | null {
  const reading = parseCedulaReading(raw);
  if (!reading) {
    return null;
  }
  return formatCedulaPhotoMessage(reading);
}
