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

/** Todo el turno es solo el clic de Facebook, sin otro pedido. */
export function isFacebookMoreInfoOpener(text: string): boolean {
  const lines = linesOf(text);
  return lines.length > 0 && lines.every(isMoreInfoOpenerLine);
}

/** Título pegado del anuncio: «esto {Fiat 500 2017}». */
export function facebookAdLabel(text: string): string | null {
  const match = text.match(/\{([^}]+)\}/);
  const label = match?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
  return label || null;
}

function foldLabel(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Botón o nombre de la casa, no un carro. */
export function isCtaAdLabel(label: string): boolean {
  const folded = foldLabel(label);
  return /\b(?:chatea|chat with us|whatsapp|escribenos|escribemos|contactanos|contactenos|conocenos|ver mas|see more|click|clic)\b|\bk-?\s*si\b|\bnuevos\b/.test(
    folded,
  );
}

/** El título parece un carro aunque el léxico todavía no lo tenga. */
export function adLabelLooksLikeVehicle(label: string): boolean {
  if (!label.trim() || isCtaAdLabel(label)) {
    return false;
  }
  if (/\b(?:19|20)\d{2}\b/.test(label) && /[a-zA-Z]{2,}/.test(label)) {
    return true;
  }
  const words = foldLabel(label)
    .split(/[^a-z0-9]+/)
    .filter((word) => /[a-z]/.test(word) && word.length >= 3);
  return words.length >= 2 || words.some((word) => word.length >= 4);
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
