import { isUuid } from '../persistence/is-uuid';

/** Apodo corto para el cliente (P7, L5). Nunca un UUID ni la placa larga. */
export function sanitizePlateShort(value: unknown): string | null {
  if (value == null || value === '') {
    return null;
  }
  const text = String(value).trim();
  if (!text || isUuid(text) || text.length > 6) {
    return null;
  }
  if (!/^[A-Za-z]{1,3}-?\d{1,3}[A-Za-z]?$/.test(text)) {
    return null;
  }
  return text.replace(/-/g, '').toUpperCase();
}
