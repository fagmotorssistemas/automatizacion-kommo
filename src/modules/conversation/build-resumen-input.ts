import { MemoryMessage } from './conversation.service';
import {
  formatTomaForResumen,
  type TomaChecklist,
} from './toma-checklist';

export const RESUMEN_HISTORY_MAX = 8;

function isHandoffContext(content: string): boolean {
  return content.startsWith('CONTEXTO ASESOR');
}

export function formatDialogueForResumen(history: MemoryMessage[]): string {
  return history
    .filter((item) => item.content && !isHandoffContext(item.content))
    .slice(-RESUMEN_HISTORY_MAX)
    .map((item) =>
      item.role === 'user' ? `Cliente: ${item.content}` : `Asesor: ${item.content}`,
    )
    .join('\n');
}

/** Lo que pide el prompt: contexto del hilo + mensaje actual. El resumen interno no va como si lo hubiera dicho el cliente. */
export function buildResumenInput(input: {
  history: MemoryMessage[];
  customerText: string;
  handoffBrief?: string | null;
  tomaChecklist?: TomaChecklist | null;
}): string {
  const parts: string[] = [];
  if (input.handoffBrief?.trim()) {
    parts.push(`RESUMEN DEL TRAMO CON ASESOR:\n${input.handoffBrief.trim()}`);
  }
  const tomaPrev = formatTomaForResumen(input.tomaChecklist ?? null);
  if (tomaPrev) {
    parts.push(`CHECKLIST TOMA YA GUARDADO:\n${tomaPrev}`);
  }

  const historial = formatDialogueForResumen(input.history);
  if (historial) {
    parts.push(`HISTORIAL:\n${historial}`);
  }

  parts.push(`MENSAJE ACTUAL:\n${input.customerText.trim()}`);
  return parts.join('\n\n');
}
