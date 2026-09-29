import { isBareConfirmation } from '../inbox/first-touch';
import { parsePassengerAsk } from '../conversation/large-passenger';
import { isThreadAck } from './parse-resumen';

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
    /\b(?:en\s+)?donde\s+(?:(?:la|el|los|las)\s+)?(?:estan|esta|queda|quedan|ver|verla|los encuentro|la encuentro|puedo|puede)\b/.test(
      n,
    )
  );
}

/** El cliente preguntó si atienden / el horario. Ir de visita no es esto. */
export function textAsksForHours(text: string): boolean {
  const n = fold(text);
  return /\b(?:horarios?|atienden?|abren|cierran|estan abiertos?|a que hora)\b/.test(
    n,
  );
}

/** Otras / alternativas, pero después. No es listado de este turno. */
export function otrasDiferidas(text: string): boolean {
  const n = fold(text).replace(/\bde la manana\b/g, ' ');
  if (!n.trim()) {
    return false;
  }
  const catalog = /\b(?:otras?|similar(?:es)?|alternativas?)\b/;
  const later =
    /\b(?:manana|mas adelante|mas tarde|otro (?:dia|momento)|luego|la otra semana|aun no|no ahora)\b/;
  return catalog.test(n) && later.test(n);
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

/** El turno solo acepta lo que el bot acaba de ofrecer o preguntar. */
export function acceptsLastAssistantAsk(customerText: string): boolean {
  return isThreadAck(customerText) || isBareConfirmation(customerText);
}

/**
 * El analizador no puede inventar banderas. Si el mensaje no las pidió, quedan no.
 * Si el bot preguntó un dato y este turno solo acepta, ese dato sí se pide.
 */
export function sanitizeInventedResumenFlags(
  resumen: string,
  customerText: string,
  lastAssistant = '',
): string {
  let out = resumen;
  const hours =
    textAsksForHours(customerText) ||
    (acceptsLastAssistantAsk(customerText) && textAsksForHours(lastAssistant));
  const location =
    textAsksForLocation(customerText) ||
    (acceptsLastAssistantAsk(customerText) &&
      textAsksForLocation(lastAssistant));
  if (location && !textAsksForLocation(customerText)) {
    out = replaceFlag(out, 'Pide ubicaci[oó]n', 'sí');
  } else if (!location) {
    out = forceFlagNo(out, 'Pide ubicaci[oó]n');
  }
  if (hours && !textAsksForHours(customerText)) {
    out = replaceFlag(out, 'Pide horario', 'sí');
  } else if (!hours) {
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
  if (otrasDiferidas(customerText)) {
    out = forceFlagNo(out, 'Pide otras');
  }
  return out;
}
