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
