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

function parseAmountToken(raw: string): number | null {
  const grouped = raw.replace(/[.,](?=\d{3}(?:[.,]|$))/g, '');
  const n = Number(grouped.replace(/[.,]\d+$/, ''));
  if (!Number.isFinite(n) || n < 500 || n > 200000) {
    return null;
  }
  return Math.round(n);
}

/** Monto de entrada dicho en el texto. No toma el precio de contado. */
export function parseDownPayment(text: string): number | null {
  const n = fold(text);
  const mil = n.match(
    /(\d{1,3})\s*mil(?:es)?(?:\s+de)?(?:\s+(?:entrada|inicial))?/,
  );
  if (mil && /\b(?:entrada|inicial)\b/.test(n)) {
    const v = Number(mil[1]) * 1000;
    if (v >= 500 && v <= 200000) {
      return v;
    }
  }
  const around = n.match(
    /entrada[^\d$]{0,24}(?:\$\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{3,6})|(?:\$\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{3,6})\s*(?:dolares?\s*)?(?:de\s+)?entrada/,
  );
  const token = around?.[1] ?? around?.[2];
  return token ? parseAmountToken(token) : null;
}

/** Años de financiamiento. “48 meses” = 4. */
export function parseFinancingYears(text: string): number | null {
  const n = fold(text);
  const meses = n.match(/\b(\d{1,2})\s*meses\b/);
  if (meses) {
    const m = Number(meses[1]);
    if (m >= 12 && m <= 84) {
      return Math.round(m / 12);
    }
  }
  const anos = n.match(/\b(\d{1,2})\s*(?:anios|anos)\b/);
  if (anos) {
    const y = Number(anos[1]);
    if (y >= 1 && y <= 7) {
      return y;
    }
  }
  return null;
}

export function financingInputsFromThread(
  customerText: string,
  resumen = '',
  history?: { role: string; content: string }[],
): { entrada: number | null; anos: number | null } {
  const blobs = [
    `${customerText}\n${resumen}`,
    customerText,
    resumen,
    ...(history ?? [])
      .filter((item) => item.role === 'user')
      .map((item) => item.content)
      .reverse(),
    ...(history ?? []).map((item) => item.content).reverse(),
  ];
  let entrada: number | null = null;
  let anos: number | null = null;
  for (const blob of blobs) {
    if (entrada == null) {
      entrada = parseDownPayment(blob);
    }
    if (anos == null) {
      anos = parseFinancingYears(blob);
    }
    if (entrada != null && anos != null) {
      break;
    }
  }
  return { entrada, anos };
}

/** Ya dijo un monto de entrada o un plazo: se puede armar la cuota. */
export function gaveFinancingInputs(text: string, resumen = ''): boolean {
  const solicitud = `${text}\n${resumen}`.toLowerCase();
  const n = fold(solicitud);
  if (parseFinancingYears(solicitud) != null) {
    return true;
  }
  if (parseDownPayment(solicitud) != null) {
    return true;
  }
  if (/\b\d{1,2}\s*(?:anios|anos|meses)\b/.test(n)) {
    return true;
  }
  if (/\$\s*\d{2,6}/.test(solicitud) && /\bentrada\b/.test(n)) {
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
  if (!/\$\s*\d/.test(text)) {
    return false;
  }
  const withoutEntrada = text.replace(
    /entrada[^$]{0,24}\$\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/gi,
    '',
  ).replace(
    /\$\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?[^.]{0,24}entrada/gi,
    '',
  );
  if (!/\$\s*\d/.test(withoutEntrada)) {
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
  // «ver si aplica» ya es la pregunta del crédito, con o sin la palabra «crédito».
  if (/ver si aplica/.test(n)) {
    return true;
  }
  return /ayudemos/.test(n) && /\b(?:este\s+)?(?:financiamiento|credito)\b/.test(n);
}

export function historyAskedIfApplies(
  history?: { role: string; content: string }[],
): boolean {
  return (history ?? []).some(
    (item) =>
      item.role === 'assistant' &&
      replyAsksIfApplies(item.content) &&
      replyShowsCuota(item.content),
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

/** Sin cuota en la frase, no se pregunta si aplica. */
export function stripPrematureApplyAsk(text: string): string {
  if (replyShowsCuota(text)) {
    return text;
  }
  return text
    .replace(
      /¿?\s*desea que (?:le ayudemos|un asesor le ayude(?:mos)?) a ver si aplica[^.?¡!\n]*[.?!]?\s*/gi,
      '',
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Pega la cuota calculada y quita el resto cortado (“y financiamiento…”). */
export function mergeFinancingQuote(reply: string, quote: string): string {
  const leftover = stripPrematureApplyAsk(stripPrematureIdentityAsk(reply))
    .replace(/^[yY]\s+financiamiento\b[^.]*\.\s*/u, '')
    .replace(
      /este valor es referencial[^]*?(?:condiciones\.|usted\.)/gi,
      '',
    )
    .replace(/^[yY]\s+/, '')
    .trim();
  const useful =
    leftover &&
    leftover.length > 12 &&
    !/^este valor es referencial/i.test(leftover)
      ? leftover
      : '';
  return useful ? `${quote} ${useful}`.trim() : quote;
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
  showedCuotaNow?: boolean;
}): boolean {
  if (input.hasCedula || !input.aceptaCredito) {
    return false;
  }
  if (input.showedCuotaNow) {
    return false;
  }
  if (!historyHasShownCuota(input.history)) {
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
