import { normalizeVacanteText } from './is-vacante-asesor';

const EXACT = 'hola. me interesa el puesto de desarrollador de software.';
const PHRASE = 'vacante de desarrollador de software';

/** Anuncio de WhatsApp de la vacante de desarrollador, o el mismo texto si la nombra. Sin modelo. */
export function isVacanteDesarrollador(text: string): boolean {
  const normalized = normalizeVacanteText(text);
  if (!normalized) {
    return false;
  }

  if (normalized === EXACT || normalized === EXACT.slice(0, -1)) {
    return true;
  }

  return normalized.includes(PHRASE);
}
