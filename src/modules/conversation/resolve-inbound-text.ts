import {
  adLabelLooksLikeVehicle,
  hasFacebookMoreInfoClick,
  isCtaAdLabel,
} from '../inbox/first-touch';
import { CtwaMatch } from '../persistence/lead.types';

/** cumple_rango_tiempo: |mensaje - clic| <= 60 s */
export const CTWA_WINDOW_SECONDS = 60;

export type InboundTextResult = {
  message: string | null;
  source: 'ad' | 'buffer' | 'none';
  vehicle: string | null;
  withinWindow: boolean;
};

export function isCtwaWithinWindow(
  createdAtUnix: string,
  capturedAtIso: string | null,
  windowSeconds = CTWA_WINDOW_SECONDS,
): boolean {
  if (!capturedAtIso) {
    return false;
  }

  const mensajeMs = Number.parseInt(createdAtUnix, 10) * 1000;
  const clicMs = new Date(capturedAtIso).getTime();
  if (!Number.isFinite(mensajeMs) || !Number.isFinite(clicMs)) {
    return false;
  }

  return Math.abs(mensajeMs - clicMs) / 1000 <= windowSeconds;
}

/** parcear_texto_inicial: "esto" → "esto {vehículo}", si no, se concatena. */
export function annotateTextWithVehicle(
  text: string,
  vehicle: string | null,
): string {
  if (!vehicle) {
    return text;
  }

  if (/\besto\b/i.test(text)) {
    return text.replace(/\besto\b/i, `esto {${vehicle}}`);
  }

  return text.trim() ? `${text} {${vehicle}}` : `{${vehicle}}`;
}

/**
 * El título del anuncio solo entra en el primer mensaje, y solo si es la
 * plantilla de Facebook («más información sobre esto») sin un modelo.
 * Si ya nombró el carro, o ya hay conversación, el texto se queda como llegó.
 */
export function resolveInboundText(input: {
  joinedText: string;
  createdAtUnix: string;
  ctwa: CtwaMatch;
  alreadyInConversation?: boolean;
}): InboundTextResult {
  const buffer = input.joinedText;
  const unmatched: InboundTextResult = {
    message: buffer || null,
    source: buffer ? 'buffer' : 'none',
    vehicle: null,
    withinWindow: false,
  };

  if (!input.ctwa.matched) {
    return unmatched;
  }

  const withinWindow = isCtwaWithinWindow(
    input.createdAtUnix,
    input.ctwa.capturedAt,
  );
  if (!withinWindow) {
    return unmatched;
  }

  const headline = input.ctwa.adHeadline?.trim() ?? '';
  const attachHeadline =
    !input.alreadyInConversation &&
    Boolean(headline) &&
    !isCtaAdLabel(headline) &&
    adLabelLooksLikeVehicle(headline) &&
    (headline.match(/\b(?:19|20)\d{2}\b/g) ?? []).length < 2 &&
    hasFacebookMoreInfoClick(buffer);
  if (!attachHeadline) {
    return { ...unmatched, withinWindow: true };
  }

  const annotated = annotateTextWithVehicle(buffer, input.ctwa.adHeadline);
  if (annotated.trim()) {
    return {
      message: annotated,
      source: input.ctwa.adHeadline ? 'ad' : 'buffer',
      vehicle: input.ctwa.adHeadline,
      withinWindow: true,
    };
  }

  return unmatched;
}
