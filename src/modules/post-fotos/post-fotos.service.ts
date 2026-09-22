import { Inject, Injectable, Logger } from '@nestjs/common';
import { CrmService } from '../crm/crm.service';
import { OUTBOUND_CONFIG, type OutboundConfig } from '../outbound/outbound.config';
import {
  POST_FOTOS_BATCH_LIMIT,
  POST_FOTOS_SALESBOT_ID,
  POST_FOTOS_WAIT_MS,
} from './post-fotos.constants';
import { PostFotosLlmClient } from './post-fotos-llm.client';
import type { PostFotosCarInput } from './post-fotos.prompt';
import { PostFotosRepository } from './post-fotos.repository';

export type PostFotosRunResult = {
  examined: number;
  sent: number;
  failed: number;
  shadowed: number;
};

@Injectable()
export class PostFotosService {
  private readonly logger = new Logger(PostFotosService.name);
  private running = false;

  constructor(
    private readonly repository: PostFotosRepository,
    private readonly llm: PostFotosLlmClient,
    private readonly crm: CrmService,
    @Inject(OUTBOUND_CONFIG) private readonly outboundConfig: OutboundConfig,
  ) {}

  async runOnce(limit = POST_FOTOS_BATCH_LIMIT): Promise<PostFotosRunResult> {
    const empty: PostFotosRunResult = {
      examined: 0,
      sent: 0,
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
          }
        } catch (error) {
          result.failed += 1;
          this.logger.error(
            `Post-fotos lead=${row.leadIdKommo}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
      if (result.examined > 0) {
        this.logger.log(
          `Post-fotos examined=${result.examined} sent=${result.sent} shadow=${result.shadowed} failed=${result.failed}`,
        );
      }
      return result;
    } finally {
      this.running = false;
    }
  }

  private async processOne(
    row: PostFotosCarInput,
  ): Promise<'sent' | 'shadow'> {
    const leadId = String(row.leadIdKommo);
    if (await this.crm.isLeadBotStopped(leadId)) {
      await this.repository.markMensajeEnviado(row.leadIdKommo);
      this.logger.log(
        `Post-fotos omitido bot_stopped lead=${row.leadIdKommo}`,
      );
      return 'sent';
    }

    const mensaje = await this.llm.draft(row);
    if (!mensaje) {
      throw new Error('LLM sin mensaje');
    }

    if (this.outboundConfig.shadowMode) {
      this.logger.log(
        [
          'SHADOW: post-fotos no se envía a WhatsApp',
          `lead=${row.leadIdKommo} contact=${row.contactId}`,
          `${row.brand ?? ''} ${row.model ?? ''} ${row.year ?? ''}`.trim(),
          '--- TEXTO ---',
          mensaje,
          '-------------',
        ].join('\n'),
      );
      await this.repository.markMensajeEnviado(row.leadIdKommo);
      return 'shadow';
    }

    const wrote = await this.crm.setRespuestaIa(leadId, mensaje);
    if (!wrote) {
      throw new Error('No se escribió campo 2991944');
    }

    await sleep(POST_FOTOS_WAIT_MS);

    const ran = await this.crm.runSalesbot(POST_FOTOS_SALESBOT_ID, leadId);
    if (!ran) {
      throw new Error(`Salesbot ${POST_FOTOS_SALESBOT_ID} falló`);
    }

    await this.repository.markMensajeEnviado(row.leadIdKommo);
    return 'sent';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
