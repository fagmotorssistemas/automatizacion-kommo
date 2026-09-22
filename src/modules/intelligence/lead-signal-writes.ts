import { LeadSignalPatch, LeadSignalWrites } from '../persistence/lead.types';
import { TurnSignals } from './analyze-turn';

export type { LeadSignalWrites };

/** If11 / If7 / If12 / If19. If7 usa solo financiamiento, no el OR de atención. */
export function planLeadSignalWrites(signals: TurnSignals): LeadSignalWrites {
  const patch: LeadSignalPatch = {};

  if (signals.photosJustSent) {
    patch.respondio_post_fotos = false;
    if (signals.fotosEnviadasAt) {
      patch.fotos_enviadas_at = signals.fotosEnviadasAt;
    }
  } else if (signals.respondioPostFotos === true) {
    patch.respondio_post_fotos = true;
  }

  if (signals.quiereLlamada) {
    patch.quiere_llamada = true;
  }

  if (signals.alertaFaltaDatos) {
    patch.status = 'datos_pedidos';
  }

  if (signals.detectadoAsesorFinanciamiento && signals.cedula) {
    patch.status = 'asesoria_financiamiento';
    patch.cedula = signals.cedula;
  }

  if (signals.clienteTieneLimitePresupuesto) {
    patch.presupuesto_cliente = signals.contexto ?? '';
  }

  return {
    patch,
    missingData: signals.alertaFaltaDatos
      ? { message: signals.solicitudCliente ?? '' }
      : null,
    financingAdvice: signals.detectadoAsesorFinanciamiento && signals.cedula
      ? { message: signals.cedula }
      : null,
  };
}
