import { Injectable, Logger } from '@nestjs/common';
import { CrmService } from '../crm/crm.service';
import { InboxRoute, routeByOrigin } from '../inbox/inbox.routing';
import {
  classifyMessageKind,
  MessageKind,
} from '../media/classify-message-kind';
import { MediaService } from '../media/media.service';
import { InboxService } from '../inbox/inbox.service';
import { RunLogService } from '../runs/run-log.service';
import {
  isCustomerInbound,
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
        | 'internal_error';
    };

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly inboxService: InboxService,
    private readonly crmService: CrmService,
    private readonly mediaService: MediaService,
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

    if (!isCustomerInbound(parsed.data)) {
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

    if (route === 'waba') {
      const stopped = await this.crmService.isLeadBotStopped(parsed.data.leadId);
      if (stopped) {
        await this.runLog.record({
          ...ctx,
          step: 'webhook',
          status: 'skipped',
          reason: 'bot_stopped',
        });
        return { accepted: false, reason: 'bot_stopped' };
      }
    }

    const phone =
      route === 'waba'
        ? await this.crmService.getContactPhone(parsed.data.contactId)
        : null;

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
}
