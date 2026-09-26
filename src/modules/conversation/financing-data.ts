export const FINANCING_APPLY_ASK =
  '¿Desea que le ayudemos a ver si aplica al crédito?';

export const FINANCING_DATA_ASK =
  'Para seguir con el crédito, ¿me ayuda con estos datos: su cédula, su nombre completo y de dónde es?';

export const FINANCING_DECLINE =
  'Estimado, estamos aquí para ayudarle. Cuando guste seguimos con esta unidad o vemos otra que le encaje. ¿Quiere que le cuente más del vehículo o prefiere venir a verlo?';

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Ya dijo un monto de entrada o un plazo: se puede armar la cuota. */
export function gaveFinancingInputs(text: string, resumen = ''): boolean {
  const solicitud = `${text}\n${resumen}`.toLowerCase();
  const n = fold(solicitud);
  if (/\b\d{1,2}\s*(?:anios|anos|meses)\b/.test(n)) {
    return true;
  }
  if (/\$\s*\d{2,6}/.test(solicitud)) {
    return true;
  }
  if (/\b\d+\s*mil\b/.test(n)) {
    return true;
  }
  return /\bentrada\s+(?:de\s+)?\d/.test(n);
}

/** Este texto ya dice una cuota con $. */
export function replyShowsCuota(text: string): boolean {
  const n = fold(text);
  if (!/\$\s*\d{2,6}/.test(text)) {
    return false;
  }
  if (/\bcuota\b/.test(n)) {
    return true;
  }
  return (
    /\bmensual\b/.test(n) &&
    /\b(?:financi|credito|entrada|meses|anos|anios)\b/.test(n)
  );
}

export function historyHasShownCuota(
  history?: { role: string; content: string }[],
): boolean {
  return (history ?? []).some(
    (item) => item.role === 'assistant' && replyShowsCuota(item.content),
  );
}

export function replyAsksIfApplies(text: string): boolean {
  const n = fold(text);
  if (/ver si aplica/.test(n) && /\bcredito\b/.test(n)) {
    return true;
  }
  return /ayudemos/.test(n) && /\b(?:este\s+)?(?:financiamiento|credito)\b/.test(n);
}

export function historyAskedIfApplies(
  history?: { role: string; content: string }[],
): boolean {
  return (history ?? []).some(
    (item) => item.role === 'assistant' && replyAsksIfApplies(item.content),
  );
}

export function replyAsksFinancingData(text: string): boolean {
  const n = fold(text);
  return (
    /cedula/.test(n) &&
    /nombre/.test(n) &&
    /\b(?:de donde|origen|vive|ciudad)\b/.test(n)
  );
}

export function historyAskedFinancingData(
  history?: { role: string; content: string }[],
): boolean {
  return (history ?? []).some(
    (item) => item.role === 'assistant' && replyAsksFinancingData(item.content),
  );
}

export function replySaidFinancingDecline(text: string): boolean {
  return fold(text).includes(fold(FINANCING_DECLINE).slice(0, 40));
}

export function historySaidFinancingDecline(
  history?: { role: string; content: string }[],
): boolean {
  return (history ?? []).some(
    (item) =>
      item.role === 'assistant' && replySaidFinancingDecline(item.content),
  );
}

/** No usar “gestionar esto”; la pregunta correcta es ver si aplica. */
export function stripGestionarOffer(text: string): string {
  return text
    .replace(
      /¿?\s*desea(?:n)? que le ayudemos (?:para |a )?gestionar[^.?¡!]*[.?¡!]?\s*/gi,
      '',
    )
    .replace(
      /¿?\s*desea que le ayude (?:para |a )?gestionar[^.?¡!]*[.?¡!]?\s*/gi,
      '',
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** En el turno de la cuota no se piden cédula, nombre ni origen. */
export function stripPrematureIdentityAsk(text: string): string {
  return text
    .replace(
      /[^.?!\n]*\b(?:c[eé]dula|nombre completo|de d[oó]nde es)[^.?!\n]*[.?!]?\s*/gi,
      '',
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function shouldAskIfApplies(input: {
  showedCuotaNow: boolean;
  hasCedula: boolean;
  history?: { role: string; content: string }[];
  reply?: string;
}): boolean {
  if (!input.showedCuotaNow || input.hasCedula) {
    return false;
  }
  if (historyAskedIfApplies(input.history) || historyAskedFinancingData(input.history)) {
    return false;
  }
  if (input.reply && replyAsksIfApplies(input.reply)) {
    return false;
  }
  return true;
}

export function shouldAskFinancingData(input: {
  history?: { role: string; content: string }[];
  aceptaCredito: boolean;
  hasCedula: boolean;
  reply?: string;
}): boolean {
  if (input.hasCedula || !input.aceptaCredito) {
    return false;
  }
  if (!historyHasShownCuota(input.history) && !historyAskedIfApplies(input.history)) {
    return false;
  }
  if (historyAskedFinancingData(input.history)) {
    return false;
  }
  if (input.reply && replyAsksFinancingData(input.reply)) {
    return false;
  }
  return true;
}

export function shouldEncourageAfterDecline(input: {
  history?: { role: string; content: string }[];
  rechazaAplicar: boolean;
  hasCedula: boolean;
  reply?: string;
}): boolean {
  if (input.hasCedula || !input.rechazaAplicar) {
    return false;
  }
  if (!historyAskedIfApplies(input.history)) {
    return false;
  }
  if (historySaidFinancingDecline(input.history)) {
    return false;
  }
  if (input.reply && replySaidFinancingDecline(input.reply)) {
    return false;
  }
  return true;
}

export function appendLine(text: string, extra: string): string {
  const body = text.trim();
  if (!body) {
    return extra;
  }
  if (fold(body).includes(fold(extra).slice(0, 32))) {
    return body;
  }
  return `${body}\n\n${extra}`;
}

export function appendApplyAsk(text: string): string {
  return appendLine(text, FINANCING_APPLY_ASK);
}

export function appendFinancingDataAsk(text: string): string {
  return appendLine(text, FINANCING_DATA_ASK);
}

export function appendFinancingDecline(text: string): string {
  return appendLine(text, FINANCING_DECLINE);
}
