import { Injectable, Logger } from '@nestjs/common';
import { AgentTurnResult } from '../agent/parse-agent-output';
import { AgentService } from '../agent/agent.service';
import { ConversationService } from '../conversation/conversation.service';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { OutboundService } from '../outbound/outbound.service';
import { asksForPhotos } from '../outbound/should-send-photos';
import {
  resumenAsksForListedPrice,
  resumenAsksForPhotos,
} from '../intelligence/parse-resumen';
import { LeadRow } from '../persistence/lead.types';
import { PersistenceService } from '../persistence/persistence.service';
import { RunLogService } from '../runs/run-log.service';
import { InboxService } from './inbox.service';
import { InboxDebounceJobData } from './inbox-debounce.queue';
import { isBareConfirmation } from './first-touch';
import {
  AGENT_TURN_TIMEOUT_MS,
  INTELLIGENCE_TIMEOUT_MS,
  turnRetryFlushMessageId,
} from './inbox.constants';
import { routeByOrigin } from './inbox.routing';
import { OtherChannelService } from './other-channel.service';
import { withTimeout } from './with-timeout';

type PendingIntelligence = {
  contactId: string;
  leadId: string;
  customerText: string;
  turn: AgentTurnResult;
  photoBotsSent: number;
  storedLead: LeadRow | null;
};

@Injectable()
export class InboxFlushRunner {
  private readonly logger = new Logger(InboxFlushRunner.name);

  constructor(
    private readonly inboxService: InboxService,
    private readonly persistenceService: PersistenceService,
    private readonly conversationService: ConversationService,
    private readonly agentService: AgentService,
    private readonly outboundService: OutboundService,
    private readonly intelligenceService: IntelligenceService,
    private readonly otherChannel: OtherChannelService,
    private readonly runLog: RunLogService,
  ) {}

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
      this.logger.error(`Flush falló contactId=${data.contactId} ${message}`);
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
    const lockRetry = data.lockRetry ?? 0;
    const flushMessageId =
      lockRetry > 0
        ? turnRetryFlushMessageId(data.messageId, lockRetry)
        : data.messageId;
    const result = await this.inboxService.flushIfLatest(
      data.contactId,
      flushMessageId,
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
      reason: lockRetry > 0 ? 'reintento_turno' : 'ganador',
      detail: { texto: result.text.slice(0, 500), lockRetry },
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
      await this.inboxService.hasOutboundSent(data.contactId, data.messageId)
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
      const scheduled = await this.inboxService.scheduleTurnRetry({
        ...data,
        text: result.text,
      });
      await this.runLog.record({
        ...ctx,
        step: 'outbound',
        status: 'skipped',
        reason:
          scheduled === 'scheduled' ? 'turno_ocupado' : 'turno_ocupado_agotado',
        detail: {
          retry: scheduled === 'scheduled',
          lockRetry: lockRetry + 1,
        },
      });
      return;
    }

    let pending: PendingIntelligence | null = null;
    try {
      pending = await this.runLockedTurn(data, ctx, inbound.message, synced);
    } finally {
      await this.inboxService.releaseTurn(data.contactId);
    }

    if (pending) {
      void this.runIntelligence(ctx, pending);
    }
  }

  private async runLockedTurn(
    data: InboxDebounceJobData,
    ctx: { contactId: string; leadId: string; messageId: string },
    customerText: string,
    synced: Awaited<ReturnType<PersistenceService['syncInboundLead']>>,
  ): Promise<PendingIntelligence | null> {
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
      return null;
    }

    let turn;
    try {
      turn = await withTimeout(
        this.agentService.handleTurn({
          contactId: data.contactId,
          customerText,
        }),
        AGENT_TURN_TIMEOUT_MS,
        'handleTurn',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.runLog.record({
        ...ctx,
        step: 'agent',
        status: 'error',
        reason: message.includes('tardó más') ? 'timeout' : 'openai_o_agente',
        detail: { texto: customerText.slice(0, 500) },
        error: message,
      });
      return null;
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
      return null;
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
        (await this.persistenceService.hasShownCar(data.contactId, inventoryId))
      : false;
    const wantsPhotos =
      Boolean(turn.photoQueue?.length) ||
      asksForPhotos(customerText) ||
      resumenAsksForPhotos(turn.resumen);
    if (turn.photoQueue && turn.photoQueue.length > 0) {
      const last = turn.photoQueue[turn.photoQueue.length - 1];
      turn.reply.meta.vehiculo = {
        ...(turn.reply.meta.vehiculo ?? {}),
        inventory_id: last.inventoryId,
      };
    }
    const outbound = await this.outboundService.dispatch(
      data.leadId,
      turn.reply,
      {
        alreadyShown,
        wantsPhotos,
        photoQueue: turn.photoQueue,
        skipFirstShot:
          Boolean(latestShown) &&
          resumenAsksForListedPrice(turn.resumen) &&
          !wantsPhotos,
      },
    );
    if (!outbound.shadow) {
      await this.inboxService.markOutboundSent(data.contactId, data.messageId);
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

    return {
      contactId: data.contactId,
      leadId: data.leadId,
      customerText,
      turn,
      photoBotsSent: outbound.photoBots.length,
      storedLead,
    };
  }

  private async runIntelligence(
    ctx: { contactId: string; leadId: string; messageId: string },
    pending: PendingIntelligence,
  ): Promise<void> {
    try {
      await withTimeout(
        this.intelligenceService.afterReply({
          contactId: pending.contactId,
          leadId: pending.leadId,
          lead: pending.storedLead,
          customerText: pending.customerText,
          resumen: pending.turn.resumen,
          reply: pending.turn.reply,
          photoBotsSent: pending.photoBotsSent,
        }),
        INTELLIGENCE_TIMEOUT_MS,
        'intelligence',
      );
      await this.runLog.record({
        ...ctx,
        step: 'intelligence',
        status: 'ok',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.runLog.record({
        ...ctx,
        step: 'intelligence',
        status: 'error',
        reason: message.includes('tardó más') ? 'timeout' : 'senales',
        error: message,
      });
    }
  }
}
