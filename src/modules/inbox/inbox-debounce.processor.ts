import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AgentService } from '../agent/agent.service';
import { ConversationService } from '../conversation/conversation.service';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { OutboundService } from '../outbound/outbound.service';
import { asksForPhotos } from '../outbound/should-send-photos';
import { resumenAsksForListedPrice } from '../intelligence/parse-resumen';
import { PersistenceService } from '../persistence/persistence.service';
import { RunLogService } from '../runs/run-log.service';
import { InboxService } from './inbox.service';
import {
  INBOX_DEBOUNCE_QUEUE,
  InboxDebounceJobData,
} from './inbox-debounce.queue';
import { isBareConfirmation } from './first-touch';
import { routeByOrigin } from './inbox.routing';
import { OtherChannelService } from './other-channel.service';

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
    private readonly otherChannel: OtherChannelService,
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

    if (routeByOrigin(data.source) !== 'waba') {
      const handled = await this.otherChannel.handle({
        leadId: data.leadId,
        contactId: data.contactId,
        name: data.name,
        text: result.text,
      });
      await this.runLog.record({
        ...ctx,
        step: 'other_channel',
        status: handled.action === 'no_lead' ? 'skipped' : 'ok',
        reason: handled.action,
        detail: {
          phone: handled.phone,
          targetLeadId: handled.targetLeadId,
          shadow: handled.shadow,
        },
      });
      return;
    }

    const synced = await this.persistenceService.syncInboundLead({
      contactId: data.contactId,
      leadIdKommo: data.leadId,
      name: data.name,
      phone: data.phone,
      source: data.source,
      assignedTo: data.assignedTo,
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

    const live = await this.conversationService.recentMessages(data.contactId);
    const alreadyInConversation =
      live.length > 0 ||
      (await this.persistenceService.loadRecentChat(data.contactId)).length > 0;

    const inbound = this.conversationService.resolveInboundText({
      joinedText: result.text,
      createdAtUnix: data.createdAt,
      ctwa: synced.ctwa,
      alreadyInConversation,
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

    const locked = await this.inboxService.claimTurn(data.contactId);
    if (!locked) {
      await this.runLog.record({
        ...ctx,
        step: 'outbound',
        status: 'skipped',
        reason: 'turno_ocupado',
      });
      return;
    }

    try {
      await this.runLockedTurn(data, ctx, inbound.message, synced);
    } finally {
      await this.inboxService.releaseTurn(data.contactId);
    }
  }

  private async runLockedTurn(
    data: InboxDebounceJobData,
    ctx: { contactId: string; leadId: string; messageId: string },
    customerText: string,
    synced: Awaited<ReturnType<PersistenceService['syncInboundLead']>>,
  ): Promise<void> {
    if (
      isBareConfirmation(customerText) &&
      (await this.inboxService.hasRecentOutbound(data.contactId))
    ) {
      await this.conversationService.appendMessage(data.contactId, {
        role: 'user',
        content: customerText,
      });
      await this.runLog.record({
        ...ctx,
        step: 'outbound',
        status: 'skipped',
        reason: 'confirmacion_ya_respondida',
      });
      return;
    }

    let turn;
    try {
      turn = await this.agentService.handleTurn({
        contactId: data.contactId,
        customerText,
      });
    } catch (error) {
      await this.runLog.record({
        ...ctx,
        step: 'agent',
        status: 'error',
        reason: 'openai_o_agente',
        detail: { texto: customerText.slice(0, 500) },
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
        detail: { texto: customerText.slice(0, 500) },
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

    const inventoryId = turn.reply.meta.vehiculo?.inventory_id?.trim() ?? '';
    const latestShown = await this.persistenceService.latestInterestedCar(
      data.contactId,
    );
    const alreadyShown = inventoryId
      ? latestShown?.inventoryId === inventoryId ||
        (await this.persistenceService.hasShownCar(
          data.contactId,
          inventoryId,
        ))
      : false;
    const outbound = await this.outboundService.dispatch(
      data.leadId,
      turn.reply,
      {
        alreadyShown,
        wantsPhotos: asksForPhotos(customerText),
        skipFirstShot:
          Boolean(latestShown) &&
          resumenAsksForListedPrice(turn.resumen) &&
          !asksForPhotos(customerText),
      },
    );
    if (!outbound.shadow) {
      await this.inboxService.markOutboundSent(
        data.contactId,
        data.messageId,
      );
    }
    if (outbound.delivered && !outbound.shadow) {
      await this.inboxService.markRecentOutbound(data.contactId);
    }

    await this.runLog.record({
      ...ctx,
      step: 'outbound',
      status: outbound.delivered ? 'ok' : 'skipped',
      reason: outbound.shadow
        ? 'shadow_no_envia'
        : outbound.missingPhotos
          ? 'enviado_sin_fotos'
          : 'enviado',
      detail: {
        mensaje: turn.reply.mensaje.slice(0, 1000),
        photoBots: outbound.photoBots,
        missingPhotos: outbound.missingPhotos,
        inventoryId: turn.reply.meta.vehiculo?.inventory_id ?? null,
      },
    });

    const storedLead =
      synced.lead.status === 'created' || synced.lead.status === 'existing'
        ? synced.lead.lead
        : null;

    if (data.assignedTo && storedLead?.id) {
      await this.persistenceService.assignLead(storedLead.id, data.assignedTo);
    }

    try {
      await this.intelligenceService.afterReply({
        contactId: data.contactId,
        leadId: data.leadId,
        lead: storedLead,
        customerText,
        resumen: turn.resumen,
        reply: turn.reply,
        photoBotsSent: outbound.photoBots.length,
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
