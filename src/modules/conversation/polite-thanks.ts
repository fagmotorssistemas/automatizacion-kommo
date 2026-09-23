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
No digas "quedamos a su disposición" ni "que tenga un excelente día" ni "cualquier consulta futura".
Sigue con el vehículo que ya se le mostró y haz UNA pregunta: financiamiento o visita.
Si todavía no hay un vehículo, pregunta cuál le interesa.`;

export const CONTESTA_DUDA = `EL CLIENTE DEJÓ UNA DUDA O MALENTENDIDO (está en el RESUMEN). NO ES DESPEDIDA.
Contesta ESA duda ahora. No cierres. No digas "quedamos atentos" ni "cualquier consulta futura" ni "cuando esté listo".
Si la duda es del km, del año o de si el carro cuadra: usa el km REAL del inventario y la línea "km vs año" (mínimo 15.000 km/año, tope 20.000). Si el uso interno pasa el tope, di DIRECTO que es un carro cuidado y en buen estado (puede traer a su mecánico). PROHIBIDO decir que el km es alto, "aunque", "a pesar de" o justificar el recorrido. Si es BAJO o ACORDE, dilo sin disculpas. Confirma ESA unidad y el precio. No solo repitas el km. Si el km aún no está cargado (0 en ficha), dilo así: no inventes 0 kilómetros.
No cambies el tema a solo financiamiento o visita hasta haber contestado la duda.`;
