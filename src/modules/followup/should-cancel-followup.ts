import { OBJECIONES_CANCELAN_SEGUIMIENTO } from './followup.constants';
import type { RetomaNumero, SeguimientoEstado } from './followup.constants';

export type FollowupCancelCheck = {
  retoma: RetomaNumero;
  seguimiento: SeguimientoEstado;
  etapaMax: number;
  objecionPrincipal: string | null;
  stop: boolean;
  botApagado: boolean;
  /** Último mensaje human del chat; si es posterior a created/programada, cancela. */
  lastHumanAt: Date | null;
  /** Momento en que se programó la fila (created_at o referencia). */
  scheduledAt: Date;
};

export function cancelReasonForFollowup(
  input: FollowupCancelCheck,
): string | null {
  if (input.stop || input.botApagado) {
    return 'stop';
  }
  if (input.seguimiento === 'cerrado') {
    return 'seguimiento_cerrado';
  }
  if (input.seguimiento === 'aplazado' && input.retoma < 3) {
    return 'seguimiento_aplazado';
  }
  if (
    input.objecionPrincipal &&
    OBJECIONES_CANCELAN_SEGUIMIENTO.has(input.objecionPrincipal)
  ) {
    return `objecion_${input.objecionPrincipal}`;
  }
  if (input.etapaMax >= 6) {
    return 'etapa_visita';
  }
  if (input.lastHumanAt && input.lastHumanAt > input.scheduledAt) {
    return 'cliente_escribio';
  }
  return null;
}
