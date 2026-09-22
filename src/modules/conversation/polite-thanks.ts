const RECHAZO =
  /\b(?:no me interesa|ya no|no gracias|chao|adi[oó]s|no me contacten|no lo contacten|ya compr[eé]|d[eé]jeme)\b/i;

const GRACIAS = /\b(?:gracias|agradezco|muy amable)\b/i;

/** Un gracias después de ver un carro es cortesía, no el cierre de la venta. */
export function isPoliteThanks(text: string): boolean {
  const clean = text.trim();
  if (!clean || RECHAZO.test(clean)) {
    return false;
  }
  return GRACIAS.test(clean);
}

export const SEGUIR_VENTA = `EL CLIENTE AGRADECIÓ. NO ES DESPEDIDA.
No digas "quedamos a su disposición" ni "que tenga un excelente día".
Sigue con el vehículo que ya se le mostró y haz UNA pregunta: financiamiento o visita.
Si todavía no hay un vehículo, pregunta cuál le interesa.`;
