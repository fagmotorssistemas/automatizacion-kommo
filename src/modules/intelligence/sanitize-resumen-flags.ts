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
  return out;
}
