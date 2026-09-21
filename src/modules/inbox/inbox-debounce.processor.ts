import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AgentService } from '../agent/agent.service';
import { ConversationService } from '../conversation/conversation.service';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { OutboundService } from '../outbound/outbound.service';
import { PersistenceService } from '../persistence/persistence.service';
import { RunLogService } from '../runs/run-log.service';
import { InboxService } from './inbox.service';
import {
  INBOX_DEBOUNCE_QUEUE,
  InboxDebounceJobData,
} from './inbox-debounce.queue';

@Processor(INBOX_DEBOUNCE_QUEUE)
export class InboxDebounceProcessor extends WorkerHost {
  private readonly logger = new Logger(InboxDebounceProcessor.name);

  constructor(
    private readonly inboxService: InboxService,
    private readonly persistenceService: PersistenceService,
    private readonly conversationService: ConversationService,
    private readonly agentService: AgentService,
    private readonly outboundService: OutboundService,
    private readonly intelligenceService: IntelligenceService,
    private readonly runLog: RunLogService,
  ) {
    super();
  }

  async process(job: Job<InboxDebounceJobData>): Promise<void> {
    await this.run(job.data);
  }

  /** Mismo flush que el worker; lo usa el timer local si BullMQ no persiste en Redis Cloud. */
  async run(data: InboxDebounceJobData): Promise<void> {
    const ctx = {
      contactId: data.contactId,
      leadId: data.leadId,
      messageId: data.messageId,
    };

    try {
      await this.processUnsafe(data, ctx);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.runLog.record({
        ...ctx,
        step: 'processor',
        status: 'error',
        reason: 'excepcion',
        error: message,
      });
      throw error;
    }
  }

  private async processUnsafe(
    data: InboxDebounceJobData,
    ctx: { contactId: string; leadId: string; messageId: string },
  ): Promise<void> {
    const result = await this.inboxService.flushIfLatest(
      data.contactId,
      data.messageId,
      data.text,
    );

    if (result.status !== 'won') {
      await this.runLog.record({
        ...ctx,
        step: 'debounce',
        status: 'skipped',
        reason: result.status,
      });
      return;
    }

    await this.runLog.record({
      ...ctx,
      step: 'debounce',
      status: 'ok',
      reason: 'ganador',
      detail: { texto: result.text.slice(0, 500) },
    });

    const synced = await this.persistenceService.syncInboundLead({
      contactId: data.contactId,
      leadIdKommo: data.leadId,
      name: data.name,
      phone: data.phone,
      source: data.source,
    });

    if (synced.lead.status === 'unavailable' || synced.lead.status === 'skipped') {
      await this.runLog.record({
        ...ctx,
        step: 'lead',
        status: 'error',
        reason: synced.lead.status,
        error:
          synced.lead.status === 'skipped'
            ? 'Supabase no configurado o sin contactId'
            : 'No se pudo leer/crear el lead',
      });
    } else {
      await this.runLog.record({
        ...ctx,
        step: 'lead',
        status: 'ok',
        reason: synced.lead.status,
        detail: { ctwa: synced.ctwa.matched },
      });
    }

    const inbound = this.conversationService.resolveInboundText({
      joinedText: result.text,
      createdAtUnix: data.createdAt,
      ctwa: synced.ctwa,
    });

    if (!inbound.message) {
      await this.runLog.record({
        ...ctx,
        step: 'texto',
        status: 'error',
        reason: 'sin_texto',
      });
      return;
    }

    if (
      await this.inboxService.hasOutboundSent(
        data.contactId,
        data.messageId,
      )
    ) {
      await this.runLog.record({
        ...ctx,
        step: 'outbound',
        status: 'skipped',
        reason: 'ya_enviado',
      });
      return;
    }

    let turn;
    try {
      turn = await this.agentService.handleTurn({
        contactId: data.contactId,
        customerText: inbound.message,
      });
    } catch (error) {
      await this.runLog.record({
        ...ctx,
        step: 'agent',
        status: 'error',
        reason: 'openai_o_agente',
        detail: { texto: inbound.message.slice(0, 500) },
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    if (!turn) {
      await this.runLog.record({
        ...ctx,
        step: 'agent',
        status: 'error',
        reason: 'sin_respuesta',
        detail: { texto: inbound.message.slice(0, 500) },
        error: 'El agente no generó texto (API key vacía o modelo vacío)',
      });
      return;
    }

    await this.runLog.record({
      ...ctx,
      step: 'agent',
      status: 'ok',
      reason: 'respuesta_generada',
      detail: {
        resumen: turn.resumen.slice(0, 500),
        mensaje: turn.reply.mensaje.slice(0, 1000),
        inventoryId: turn.reply.meta.vehiculo?.inventory_id ?? null,
        imgPrefix: turn.reply.img_prefix,
      },
    });

    const outbound = await this.outboundService.dispatch(
      data.leadId,
      turn.reply,
    );
    if (!outbound.shadow) {
      await this.inboxService.markOutboundSent(
        data.contactId,
        data.messageId,
      );
    }

    await this.runLog.record({
      ...ctx,
      step: 'outbound',
      status: outbound.delivered ? 'ok' : 'skipped',
      reason: outbound.shadow ? 'shadow_no_envia' : 'enviado',
      detail: {
        mensaje: turn.reply.mensaje.slice(0, 1000),
        photoBots: outbound.photoBots,
      },
    });

    if (outbound.shadow) {
      return;
    }

    const storedLead =
      synced.lead.status === 'created' || synced.lead.status === 'existing'
        ? synced.lead.lead
        : null;

    try {
      await this.intelligenceService.afterReply({
        contactId: data.contactId,
        leadId: data.leadId,
        lead: storedLead,
        customerText: inbound.message,
        resumen: turn.resumen,
        reply: turn.reply,
      });
      await this.runLog.record({
        ...ctx,
        step: 'intelligence',
        status: 'ok',
      });
    } catch (error) {
      await this.runLog.record({
        ...ctx,
        step: 'intelligence',
        status: 'error',
        reason: 'senales',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
