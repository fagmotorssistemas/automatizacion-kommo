export type ParsedResumen = {
  vehiculo: string | null;
  contexto: string | null;
  solicitudActual: string | null;
};

export function parseResumen(resumen: string): ParsedResumen {
  const texto = resumen || '';
  const vehiculoMatch = texto.match(/Vehículo:\s*(.+?)(?:\n|$)/i);
  const contextoMatch = texto.match(/Contexto:\s*(.+?)(?:\n\n|\nSOLICITUD|$)/is);
  const solicitudMatch = texto.match(/SOLICITUD ACTUAL:\s*(.+?)$/is);

  return {
    vehiculo: vehiculoMatch?.[1]?.trim() || null,
    contexto: contextoMatch?.[1]?.trim() || null,
    solicitudActual: solicitudMatch?.[1]?.trim() || null,
  };
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * El resumen ya interpretó el mensaje. Aquí se lee esa lectura,
 * no las palabras sueltas del cliente.
 */
export function resumenAsksForListedPrice(resumen: string): boolean {
  const flag = resumen.match(/pide\s+precio:\s*(s[ií]|no)(?:\s|$)/i);
  if (flag) {
    return /^s/i.test(flag[1]);
  }
  const solicitud = parseResumen(resumen).solicitudActual ?? resumen;
  const n = fold(solicitud);
  if (/\bprecio\s+menor\b/.test(n) || /\bpresupuesto\b/.test(n)) {
    return false;
  }
  if (/\bprecio\b/.test(n)) {
    return true;
  }
  if (/\b(cuota|entrada|inicial|kilometr|\bkm\b)\b/.test(n)) {
    return false;
  }
  return /\bvalor(?:es)?\b/.test(n);
}

function flagSiNo(resumen: string, name: string): boolean | null {
  const match = resumen.match(
    new RegExp(`${name}:\\s*(s[ií]|no)(?:\\s|$)`, 'i'),
  );
  if (!match) {
    return null;
  }
  return /^s/i.test(match[1]);
}

function stripResumenFlags(text: string): string {
  return text
    .replace(/pide\s+(?:precio|cr[eé]dito|otro\s+color):\s*(s[ií]|no)/gi, '')
    .replace(/tiene\s+duda:\s*(s[ií]|no)/gi, '')
    .replace(/es\s+despedida:\s*(s[ií]|no)/gi, '');
}

/** El mensaje da o pide entrada, plazo o crédito. */
export function textAsksForCredit(text: string): boolean {
  const n = fold(stripResumenFlags(text));
  return (
    /\b(credito|financiamiento|cuota|entrada|plazo|inicial)\b/.test(n) ||
    /\b\d+\s*an[io]s\b/.test(n)
  );
}

/** El analizador vio que quiere crédito / financiamiento, no solo el precio de contado. */
export function resumenAsksForCredit(resumen: string): boolean {
  const solicitud = parseResumen(resumen).solicitudActual ?? resumen;
  if (textAsksForCredit(solicitud)) {
    return true;
  }
  const flag = flagSiNo(resumen, 'pide\\s+cr[eé]dito');
  if (flag != null) {
    return flag;
  }
  return false;
}

/** El analizador vio que quiere otro color del mismo modelo, no la misma unidad. */
export function resumenAsksForOtherColor(resumen: string): boolean {
  const flag = flagSiNo(resumen, 'pide\\s+otro\\s+color');
  if (flag != null) {
    return flag;
  }
  const solicitud = parseResumen(resumen).solicitudActual ?? '';
  return /otro(?:s)?\s+colore?s?|otra(?:s)?\s+colore?s?/.test(fold(solicitud));
}

/** El mensaje pide otro color de la misma línea. */
export function textAsksForOtherColor(text: string): boolean {
  return /otro(?:s)?\s+colore?s?|otra(?:s)?\s+colore?s?/.test(fold(text));
}

/** El analizador vio una duda o malentendido pendiente. No es cierre. */
export function resumenHasPendingDoubt(resumen: string): boolean {
  const flag = flagSiNo(resumen, 'tiene\\s+duda');
  if (flag != null) {
    return flag;
  }
  const solicitud = parseResumen(resumen).solicitudActual ?? '';
  return /\bduda\b|\bmalentendido\b|\bincognita\b/i.test(fold(solicitud));
}

/** El analizador marcó que de verdad se va, sin duda pendiente. */
export function resumenIsFarewell(resumen: string): boolean {
  if (resumenHasPendingDoubt(resumen)) {
    return false;
  }
  return flagSiNo(resumen, 'es\\s+despedida') === true;
}
