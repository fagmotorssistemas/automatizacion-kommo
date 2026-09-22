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

export function etapaParaGuardar(etapaSql: number, agendoVisita: boolean): number {
  const sql = Number.isFinite(etapaSql) ? etapaSql : 0;
  const next = Math.max(sql, agendoVisita ? 5 : 0);
  return Math.min(5, Math.max(0, next));
}
