import { parsePassengerAsk } from '../conversation/large-passenger';

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** El cliente pidió la casa / dónde ver. “Más información” no cuenta. */
export function textAsksForLocation(text: string): boolean {
  const n = fold(text);
  return (
    /\b(?:direccion|ubicacion|ubicados?|ubicadas?|mapa|como llego|como llegar)\b/.test(
      n,
    ) ||
    /\b(?:en\s+)?donde\s+(?:estan|esta|queda|quedan|ver|verla|los encuentro|la encuentro|puedo|puede)\b/.test(
      n,
    )
  );
}

/** El cliente preguntó si atienden / el horario. Ir de visita no es esto. */
export function textAsksForHours(text: string): boolean {
  const n = fold(text);
  return /\b(?:horarios?|atienden|abren|cierran|estan abiertos?|a que hora)\b/.test(
    n,
  );
}

function forceFlagNo(resumen: string, label: string): string {
  return resumen.replace(
    new RegExp(`(${label}):\\s*s[ií]`, 'gi'),
    '$1: no',
  );
}

function replaceFlag(resumen: string, label: string, value: string): string {
  return resumen.replace(new RegExp(`(${label}):\\s*.+`, 'gi'), `$1: ${value}`);
}

/** 7 asientos / 7 plazas. El 5p del modelo son puertas, no cuenta. */
export function textAsksForSeats(text: string): number | null {
  return parsePassengerAsk(text);
}

/** 3 filas / tercera fila. Pedir 7 asientos no es esto. */
export function textAsksForTresFilas(text: string): boolean {
  const n = fold(text);
  return /\b(?:3|tres)\s+filas?\b|\btercera\s+fila\b/.test(n);
}

/**
 * El analizador no puede inventar banderas. Si el mensaje no las pidió, quedan no.
 */
export function sanitizeInventedResumenFlags(
  resumen: string,
  customerText: string,
): string {
  let out = resumen;
  if (!textAsksForLocation(customerText)) {
    out = forceFlagNo(out, 'Pide ubicaci[oó]n');
  }
  if (!textAsksForHours(customerText)) {
    out = forceFlagNo(out, 'Pide horario');
  }
  const seats = textAsksForSeats(customerText);
  out =
    seats != null
      ? replaceFlag(out, 'Asientos', String(seats))
      : replaceFlag(out, 'Asientos', 'no');
  if (!textAsksForTresFilas(customerText)) {
    out = forceFlagNo(out, 'Tres filas');
  }
  return out;
}
