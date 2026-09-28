const EXACT = 'hola. me interesa el puesto de asesor comercial.';
const PHRASE = 'vacante de asesor comercial';

export function normalizeVacanteText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Anuncio de WhatsApp, o el mismo texto si nombra la vacante. Sin modelo. */
export function isVacanteAsesorComercial(text: string): boolean {
  const normalized = normalizeVacanteText(text);
  if (!normalized) {
    return false;
  }

  if (normalized === EXACT || normalized === EXACT.slice(0, -1)) {
    return true;
  }

  return normalized.includes(PHRASE);
}
