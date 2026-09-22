import { CLOSE_WINDOW_MS, OPEN_WINDOW_MS } from './analysis.constants';

export type ConversationLifecycle = 'abierta' | 'en_reposo' | 'cerrada';

export function conversationLifecycle(
  lastMessageAt: Date,
  now: Date,
): ConversationLifecycle {
  const age = now.getTime() - lastMessageAt.getTime();
  if (age < OPEN_WINDOW_MS) {
    return 'abierta';
  }
  if (age >= CLOSE_WINDOW_MS) {
    return 'cerrada';
  }
  return 'en_reposo';
}

/** 5 = visita agendada. No baja un 6 de patio. Exige haber conversado (etapa >= 2). */
export function etapaParaGuardar(etapaSql: number, agendoVisita: boolean): number {
  const sql = Number.isFinite(etapaSql) ? etapaSql : 0;
  const bounded = Math.min(7, Math.max(0, sql));
  if (agendoVisita && bounded >= 2 && bounded < 6) {
    return Math.max(bounded, 5);
  }
  return bounded;
}
