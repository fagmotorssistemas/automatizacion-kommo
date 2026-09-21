import { Injectable, Logger } from '@nestjs/common';
import { isExcludedLead } from '../crm/is-excluded-lead';
import { CrmService } from '../crm/crm.service';
import { HandoffService } from '../handoff/handoff.service';
import { InboxRoute, routeByOrigin } from '../inbox/inbox.routing';
import {
  classifyMessageKind,
  MessageKind,
} from '../media/classify-message-kind';
import { MediaService } from '../media/media.service';
import { InboxService } from '../inbox/inbox.service';
import { PersistenceService } from '../persistence/persistence.service';
import { RunLogService } from '../runs/run-log.service';
import {
  isCustomerInbound,
  isSellerOutgoing,
  KommoInboundMessage,
  kommoInboundMessageSchema,
} from './dto/kommo-inbound-message.schema';
import { extractKommoMessageCandidate } from './kommo-webhook.parser';

export type WebhookHandleResult =
  | {
      accepted: true;
      messageId: string;
      leadId: string;
      route: InboxRoute;
      phone: string | null;
      kind: MessageKind;
      text: string;
      debounce: 'scheduled' | 'skipped';
    }
  | {
      accepted: false;
      reason:
        | 'not_a_message_event'
        | 'invalid_message'
        | 'ignored_not_inbound'
        | 'duplicate'
        | 'inbox_unavailable'
        | 'bot_stopped'
        | 'handoff_note'
        | 'excluded_lead'
        | 'internal_error';
    };

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly inboxService: InboxService,
    private readonly crmService: CrmService,
    private readonly handoff: HandoffService,
    private readonly mediaService: MediaService,
    private readonly persistence: PersistenceService,
    private readonly runLog: RunLogService,
  ) {}

  async handleKommo(body: unknown): Promise<WebhookHandleResult> {
    try {
      return await this.handleKommoUnsafe(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.runLog.record({
        step: 'webhook',
        status: 'error',
        reason: 'excepcion',
        error: message,
      });
      return { accepted: false, reason: 'internal_error' };
    }
  }

  private async handleKommoUnsafe(
    body: unknown,
  ): Promise<WebhookHandleResult> {
    const candidate = extractKommoMessageCandidate(body);
    if (!candidate) {
      await this.runLog.record({
        step: 'webhook',
        status: 'skipped',
        reason: 'not_a_message_event',
      });
      return { accepted: false, reason: 'not_a_message_event' };
    }

    const parsed = kommoInboundMessageSchema.safeParse(candidate);
    if (!parsed.success) {
      this.logger.warn('Webhook Kommo con message[add] inválido');
      await this.runLog.record({
        step: 'webhook',
        status: 'error',
        reason: 'invalid_message',
        detail: { issues: parsed.error.issues.map((issue) => issue.message) },
      });
      return { accepted: false, reason: 'invalid_message' };
    }

    const contactId = parsed.data.contactId || parsed.data.leadId;
    const ctx = {
      contactId,
      leadId: parsed.data.leadId,
      messageId: parsed.data.messageId,
    };

    if (isExcludedLead(parsed.data.leadId)) {
      await this.runLog.record({
        ...ctx,
        step: 'webhook',
        status: 'skipped',
        reason: 'excluded_lead',
      });
      return { accepted: false, reason: 'excluded_lead' };
    }

    const inbound = isCustomerInbound(parsed.data);
    const sellerNote = isSellerOutgoing(parsed.data);
    if (!inbound && !sellerNote) {
      await this.runLog.record({
        ...ctx,
        step: 'webhook',
        status: 'skipped',
        reason: 'ignored_not_inbound',
        detail: {
          direction: parsed.data.direction,
          authorType: parsed.data.authorType,
        },
      });
      return { accepted: false, reason: 'ignored_not_inbound' };
    }

    const claim = await this.inboxService.claimMessage(
      contactId,
      parsed.data.messageId,
    );
    if (claim === 'duplicate') {
      await this.runLog.record({
        ...ctx,
        step: 'webhook',
        status: 'skipped',
        reason: 'duplicate',
      });
      return { accepted: false, reason: 'duplicate' };
    }
    if (claim === 'unavailable') {
      await this.runLog.record({
        ...ctx,
        step: 'webhook',
        status: 'error',
        reason: 'inbox_unavailable',
        error: 'Redis no pudo reclamar el messageId',
      });
      return { accepted: false, reason: 'inbox_unavailable' };
    }

    const route = routeByOrigin(parsed.data.origin);
    let phone: string | null = null;
    let assignedTo: string | undefined;

    if (route === 'waba') {
      const inspected = await this.crmService.inspectLead(parsed.data.leadId);
      if (inspected.stopped) {
        return this.captureStoppedHandoff({
          ctx,
          route,
          inbound,
          contactId,
          parsed: parsed.data,
        });
      }

      assignedTo = this.handoff.assigneeFromKommoLead(inspected.raw);
      phone = await this.crmService.getContactPhone(parsed.data.contactId);
    }

    if (!inbound) {
      await this.runLog.record({
        ...ctx,
        step: 'webhook',
        status: 'skipped',
        reason: 'ignored_not_inbound',
        detail: {
          direction: parsed.data.direction,
          authorType: parsed.data.authorType,
        },
      });
      return { accepted: false, reason: 'ignored_not_inbound' };
    }

    if (route === 'waba') {
      await this.persistence.consumeHandoffTurns(contactId);
    }

    const kind = classifyMessageKind({
      attachmentType: parsed.data.attachmentType,
      messageType: parsed.data.messageType,
    });

    const text = await this.mediaService.toCustomerText({
      kind,
      text: parsed.data.text,
      attachmentLink: parsed.data.attachmentLink,
      attachmentFileName: parsed.data.attachmentFileName,
    });

    const debounce = await this.inboxService.scheduleDebounce({
      contactId,
      messageId: parsed.data.messageId,
      text,
      leadId: parsed.data.leadId,
      name: parsed.data.authorName,
      phone,
      source: parsed.data.origin,
      createdAt: parsed.data.createdAt,
      ...(assignedTo ? { assignedTo } : {}),
    });

    await this.runLog.record({
      ...ctx,
      step: 'webhook',
      status: debounce === 'scheduled' ? 'ok' : 'error',
      reason: debounce === 'scheduled' ? 'aceptado' : 'debounce_skipped',
      detail: {
        route,
        kind,
        phone,
        debounce,
        texto: text.slice(0, 500),
      },
      error:
        debounce === 'skipped' ? 'No se pudo agendar el job de 30s' : undefined,
    });

    this.logger.log(
      `Mensaje aceptado messageId=${parsed.data.messageId} leadId=${parsed.data.leadId} route=${route} kind=${kind} debounce=${debounce} texto=${text.slice(0, 180)}`,
    );

    return {
      accepted: true,
      messageId: parsed.data.messageId,
      leadId: parsed.data.leadId,
      route,
      phone,
      kind,
      text,
      debounce,
    };
  }

  private async captureStoppedHandoff(input: {
    ctx: { contactId: string; leadId: string; messageId: string };
    route: InboxRoute;
    inbound: boolean;
    contactId: string;
    parsed: KommoInboundMessage;
  }): Promise<WebhookHandleResult> {
    const kind = classifyMessageKind({
      attachmentType: input.parsed.attachmentType,
      messageType: input.parsed.messageType,
    });
    const text = input.inbound
      ? await this.mediaService.toCustomerText({
          kind,
          text: input.parsed.text,
          attachmentLink: input.parsed.attachmentLink,
          attachmentFileName: input.parsed.attachmentFileName,
        })
      : input.parsed.text.trim();

    if (text) {
      await this.persistence.recordStoppedMessage({
        contactId: input.contactId,
        leadIdKommo: input.parsed.leadId,
        name: input.parsed.authorName,
        phone: null,
        source: input.parsed.origin,
        role: input.inbound ? 'customer' : 'seller',
        text,
        authorName: input.parsed.authorName,
      });
    }

    const reason = input.inbound ? 'bot_stopped' : 'handoff_note';
    await this.runLog.record({
      ...input.ctx,
      step: 'webhook',
      status: 'skipped',
      reason,
      detail: {
        route: input.route,
        atiende_ia: true,
        quien: input.inbound ? 'cliente' : 'asesor',
        autor: input.parsed.authorName,
        texto: text.slice(0, 500),
      },
    });

    return { accepted: false, reason };
  }
}
