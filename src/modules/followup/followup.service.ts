import { Inject, Injectable, Logger } from '@nestjs/common';
import { CrmService } from '../crm/crm.service';
import { LEAD_SEND_GAP_MS } from '../outbound/outbound.constants';
import { OUTBOUND_CONFIG, type OutboundConfig } from '../outbound/outbound.config';
import {
  addBusinessHours,
  addCalendarDaysFrom,
} from './add-business-hours';
import {
  FOLLOWUP_BATCH_LIMIT,
  FOLLOWUP_SALESBOT_ID,
  retomasParaSeguimiento,
  type RetomaNumero,
  type SeguimientoEstado,
} from './followup.constants';
import { FollowupLlmClient } from './followup-llm.client';
import { FollowupRepository } from './followup.repository';
import { cancelReasonForFollowup } from './should-cancel-followup';

export type ScheduleFollowupInput = {
  sessionId: string;
  leadId: number | null;
  lastMessageAt: Date;
  seguimiento: SeguimientoEstado;
  cerrada: boolean;
};

export type FollowupRunResult = {
  examined: number;
  sent: number;
  cancelled: number;
  failed: number;
  shadowed: number;
};

@Injectable()
export class FollowupService {
  private readonly logger = new Logger(FollowupService.name);
  private running = false;

  constructor(
    private readonly repository: FollowupRepository,
    private readonly llm: FollowupLlmClient,
    private readonly crm: CrmService,
    @Inject(OUTBOUND_CONFIG) private readonly outboundConfig: OutboundConfig,
  ) {}

  /**
   * Tras análisis en reposo: programa retomas según seguimiento.
   * Si ya hay pendientes, no duplica. Si cerrado, cancela pendientes.
   */
  async scheduleAfterAnalysis(input: ScheduleFollowupInput): Promise<void> {
    if (!this.repository.isReady() || !input.sessionId) {
      return;
    }

    if (input.cerrada || input.seguimiento === 'cerrado') {
      await this.repository.cancelPending(input.sessionId, 'seguimiento_cerrado');
      return;
    }

    if (await this.repository.hasPending(input.sessionId)) {
      return;
    }

    const retomas = retomasParaSeguimiento(input.seguimiento);
    if (retomas.length === 0) {
      return;
    }

    const rows = retomas.map((retoma) => ({
      leadId: input.leadId,
      sessionId: input.sessionId,
      retoma,
      programada: this.programadaPara(retoma, input.lastMessageAt),
    }));

    await this.repository.insertScheduled(rows);
    this.logger.log(
      `Programadas retomas=${retomas.join(',')} session=${input.sessionId} seguimiento=${input.seguimiento}`,
    );
  }

  /** El cliente escribió: marca respondió la última enviada y cancela pendientes. */
  async onCustomerMessage(sessionId: string): Promise<void> {
    if (!this.repository.isReady() || !sessionId) {
      return;
    }
    try {
      await this.repository.markRespondio(sessionId);
      await this.repository.cancelPending(sessionId, 'cliente_escribio');
    } catch (error) {
      this.logger.warn(
        `onCustomerMessage ${sessionId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async runOnce(limit = FOLLOWUP_BATCH_LIMIT): Promise<FollowupRunResult> {
    const empty: FollowupRunResult = {
      examined: 0,
      sent: 0,
      cancelled: 0,
      failed: 0,
      shadowed: 0,
    };
    if (this.running) {
      return empty;
    }
    if (!this.repository.isReady() || !this.llm.isReady()) {
      return empty;
    }

    this.running = true;
    const result: FollowupRunResult = { ...empty };
    try {
      const due = await this.repository.listDue(limit);
      let pauseBeforeNext = false;
      for (const row of due) {
        if (pauseBeforeNext) {
          this.logger.log(
            `Espera ${LEAD_SEND_GAP_MS / 1000}s antes de la siguiente retoma`,
          );
          await sleep(LEAD_SEND_GAP_MS);
          pauseBeforeNext = false;
        }
        result.examined += 1;
        try {
          const outcome = await this.processDue(row);
          if (outcome === 'sent') {
            result.sent += 1;
            pauseBeforeNext = true;
          } else if (outcome === 'cancelled') {
            result.cancelled += 1;
          } else if (outcome === 'shadow') {
            result.shadowed += 1;
          }
        } catch (error) {
          result.failed += 1;
          this.logger.error(
            `Retoma id=${row.id}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
      if (result.examined > 0) {
        this.logger.log(
          `Followup examined=${result.examined} sent=${result.sent} cancelled=${result.cancelled} shadow=${result.shadowed} failed=${result.failed}`,
        );
      }
      return result;
    } finally {
      this.running = false;
    }
  }

  private async processDue(
    row: Awaited<ReturnType<FollowupRepository['listDue']>>[number],
  ): Promise<'sent' | 'cancelled' | 'shadow' | 'skipped'> {
    const reason = cancelReasonForFollowup({
      retoma: row.retoma,
      seguimiento: row.seguimiento,
      etapaMax: row.etapaMax,
      objecionPrincipal: row.objecionPrincipal,
      stop: row.stop,
      botApagado: row.botApagado,
      lastHumanAt: row.lastHumanAt,
      scheduledAt: row.createdAt,
    });
    if (reason) {
      await this.repository.markCancelled(row.id, reason);
      return 'cancelled';
    }

    if (!row.leadIdKommo) {
      await this.repository.markCancelled(row.id, 'sin_lead_kommo');
      return 'cancelled';
    }

    const mensaje = await this.llm.draft({
      retoma: row.retoma,
      resumen: row.resumen,
      vehiculos: row.vehiculos,
      objecion: row.objecionPrincipal,
      objecionTexto: row.objecionTexto,
      objecionEvidencia: row.objecionEvidencia,
      presupuesto: row.presupuesto,
    });
    if (!mensaje) {
      throw new Error('LLM sin mensaje');
    }

    if (this.outboundConfig.shadowMode) {
      this.logger.log(
        [
          'SHADOW: retoma no enviada',
          `id=${row.id} retoma=${row.retoma} lead=${row.leadIdKommo}`,
          '--- TEXTO ---',
          mensaje,
          '-------------',
        ].join('\n'),
      );
      await this.repository.markSent(row.id, mensaje);
      return 'shadow';
    }

    const wrote = await this.crm.setSeguimientoRespuesta(
      row.leadIdKommo,
      mensaje,
    );
    if (!wrote) {
      this.logger.warn(
        `Retoma id=${row.id}: Kommo no escribió campo 3039029; se cancela para no reintentar`,
      );
      await this.repository.markCancelled(row.id, 'kommo_campo_seguimiento');
      return 'cancelled';
    }

    const ran = await this.crm.runSalesbot(FOLLOWUP_SALESBOT_ID, row.leadIdKommo);
    if (!ran) {
      throw new Error(`Salesbot ${FOLLOWUP_SALESBOT_ID} falló`);
    }

    await this.repository.markSent(row.id, mensaje);
    return 'sent';
  }

  private programadaPara(retoma: RetomaNumero, lastMessageAt: Date): Date {
    if (retoma === 1) {
      return addBusinessHours(lastMessageAt, 8);
    }
    if (retoma === 2) {
      return addCalendarDaysFrom(lastMessageAt, 2);
    }
    return addCalendarDaysFrom(lastMessageAt, 7);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
