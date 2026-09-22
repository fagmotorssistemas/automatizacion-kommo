import { Injectable, Logger } from '@nestjs/common';
import { afterDelayInBusinessHours } from '../followup/add-business-hours';
import { CrmService } from '../crm/crm.service';
import { OutboundService } from '../outbound/outbound.service';
import {
  POST_FOTOS_BATCH_LIMIT,
  POST_FOTOS_DELAY_MS,
  POST_FOTOS_WAIT_MS,
  type PostFotosPaso,
} from './post-fotos.constants';
import { PostFotosLlmClient } from './post-fotos-llm.client';
import { PostFotosRepository } from './post-fotos.repository';

export type PostFotosRunResult = {
  examined: number;
  sent: number;
  failed: number;
  shadowed: number;
  cancelled: number;
};

@Injectable()
export class PostFotosService {
  private readonly logger = new Logger(PostFotosService.name);
  private running = false;

  constructor(
    private readonly repository: PostFotosRepository,
    private readonly llm: PostFotosLlmClient,
    private readonly crm: CrmService,
    private readonly outbound: OutboundService,
  ) {}

  /**
   * Tras enviar fotos: programa paso 1 a +40 min (ajustado a horario laboral).
   * No duplica si ya hay pendientes.
   */
  async scheduleAfterPhotos(input: {
    sessionId: string;
    leadId: number | null;
    fotosEnviadasAt?: Date;
  }): Promise<void> {
    if (!this.repository.isReady() || !input.sessionId) {
      return;
    }
    if (await this.repository.hasPending(input.sessionId)) {
      return;
    }

    const anchor = input.fotosEnviadasAt ?? new Date();
    const programada = afterDelayInBusinessHours(
      anchor,
      POST_FOTOS_DELAY_MS[1],
    );
    await this.repository.schedulePaso({
      leadId: input.leadId,
      sessionId: input.sessionId,
      paso: 1,
      programada,
    });
    this.logger.log(
      `Post-fotos paso=1 programado session=${input.sessionId} at=${programada.toISOString()}`,
    );
  }

  /** El cliente escribió: cancela pendientes. */
  async onCustomerMessage(sessionId: string): Promise<void> {
    if (!this.repository.isReady() || !sessionId) {
      return;
    }
    try {
      const n = await this.repository.cancelPending(
        sessionId,
        'cliente_escribio',
      );
      if (n > 0) {
        this.logger.log(
          `Post-fotos cancelados=${n} session=${sessionId} motivo=cliente_escribio`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `onCustomerMessage ${sessionId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async runOnce(limit = POST_FOTOS_BATCH_LIMIT): Promise<PostFotosRunResult> {
    const empty: PostFotosRunResult = {
      examined: 0,
      sent: 0,
      failed: 0,
      shadowed: 0,
      cancelled: 0,
    };
    if (this.running) {
      return empty;
    }
    if (!this.repository.isReady() || !this.llm.isReady()) {
      return empty;
    }

    this.running = true;
    const result: PostFotosRunResult = { ...empty };
    try {
      const due = await this.repository.listDue(limit);
      for (const row of due) {
        result.examined += 1;
        try {
          const outcome = await this.processOne(row);
          if (outcome === 'sent') {
            result.sent += 1;
          } else if (outcome === 'shadow') {
            result.shadowed += 1;
          } else if (outcome === 'cancelled') {
            result.cancelled += 1;
          }
        } catch (error) {
          result.failed += 1;
          this.logger.error(
            `Post-fotos id=${row.id} paso=${row.paso}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
      if (result.examined > 0) {
        this.logger.log(
          `Post-fotos examined=${result.examined} sent=${result.sent} shadow=${result.shadowed} cancelled=${result.cancelled} failed=${result.failed}`,
        );
      }
      return result;
    } finally {
      this.running = false;
    }
  }

  private async processOne(
    row: Awaited<ReturnType<PostFotosRepository['listDue']>>[number],
  ): Promise<'sent' | 'shadow' | 'cancelled'> {
    if (row.respondioPostFotos) {
      await this.repository.markCancelled(row.id, 'respondio_post_fotos');
      return 'cancelled';
    }
    if (!row.leadIdKommo) {
      await this.repository.markCancelled(row.id, 'sin_lead_kommo');
      return 'cancelled';
    }
    if (row.botApagado || (await this.crm.isLeadBotStopped(row.leadIdKommo))) {
      await this.repository.markCancelled(row.id, 'bot_stopped');
      return 'cancelled';
    }

    const mensaje = await this.llm.draft(row.paso, {
      name: row.name,
      brand: row.brand,
      model: row.model,
      year: row.year,
      price: row.price,
      mileage: row.mileage,
      fuelType: row.fuelType,
      color: row.color,
    });
    if (!mensaje) {
      throw new Error('LLM sin mensaje');
    }

    if (this.outbound.isShadowMode()) {
      this.logger.log(
        [
          'SHADOW: post-fotos no se envía a WhatsApp',
          `id=${row.id} paso=${row.paso} lead=${row.leadIdKommo}`,
          '--- TEXTO ---',
          mensaje,
          '-------------',
        ].join('\n'),
      );
      await this.afterSent(row, mensaje);
      return 'shadow';
    }

    const sent = await this.outbound.sendText(row.leadIdKommo, mensaje, {
      waitBeforeBotMs: POST_FOTOS_WAIT_MS,
    });
    if (!sent.wrote || !sent.botRan) {
      throw new Error('No se pudo enviar texto post-fotos');
    }

    await this.afterSent(row, mensaje);
    return 'sent';
  }

  private async afterSent(
    row: Awaited<ReturnType<PostFotosRepository['listDue']>>[number],
    mensaje: string,
  ): Promise<void> {
    await this.repository.markSent(row.id, mensaje);
    const leadIdKommo = Number(row.leadIdKommo);
    if (Number.isFinite(leadIdKommo)) {
      await this.repository.markMensajePostFotosFlag(leadIdKommo);
    }

    const next = nextPaso(row.paso);
    if (!next) {
      return;
    }

    const programada = afterDelayInBusinessHours(
      new Date(),
      POST_FOTOS_DELAY_MS[next],
    );
    await this.repository.schedulePaso({
      leadId: row.leadId,
      sessionId: row.sessionId,
      paso: next,
      programada,
    });
    this.logger.log(
      `Post-fotos paso=${next} programado session=${row.sessionId} at=${programada.toISOString()}`,
    );
  }
}

function nextPaso(paso: PostFotosPaso): PostFotosPaso | null {
  if (paso === 1) {
    return 2;
  }
  if (paso === 2) {
    return 3;
  }
  return null;
}
