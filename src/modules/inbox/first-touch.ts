function foldLine(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\{[^}]+\}/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[¡!¿?.,;:"']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function linesOf(text: string): string[] {
  return text
    .split(/\n+/)
    .map(foldLine)
    .filter(Boolean);
}

/** Plantilla de Facebook / CTWA: quiere info de “esto”, sin elegir unidad. */
export function isMoreInfoOpenerLine(line: string): boolean {
  return /^(hola\s+)?((me gustaria|quisiera|quiero|deseo|puedo obtener|podria (?:obtener|conseguir))\s+(conseguir\s+)?mas informacion(?:\s+sobre\s+(?:esto|este))?)$/.test(
    line,
  );
}

/** Todo el turno es solo el clic de Facebook. No mandar listado todavía. */
export function isFacebookMoreInfoOpener(text: string): boolean {
  const lines = linesOf(text);
  return lines.length > 0 && lines.every(isMoreInfoOpenerLine);
}

/** “Sí / ok” suelto: confirma el saludo, no pide otro listado. */
export function isBareConfirmation(text: string): boolean {
  const lines = linesOf(text);
  if (lines.length === 0) {
    return false;
  }
  return lines.every((line) =>
    /^(si|ok|okay|okey|vale)(?:\s+por\s+favor)?$/.test(line),
  );
}
