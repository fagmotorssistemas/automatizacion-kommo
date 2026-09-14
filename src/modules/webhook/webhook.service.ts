import { Injectable, Logger } from '@nestjs/common';
import { CrmService } from '../crm/crm.service';
import { InboxRoute, routeByOrigin } from '../inbox/inbox.routing';
import {
  classifyMessageKind,
  MessageKind,
} from '../media/classify-message-kind';
import { MediaService } from '../media/media.service';
import { InboxService } from '../inbox/inbox.service';
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
        | 'bot_stopped';
    };

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly inboxService: InboxService,
    private readonly crmService: CrmService,
    private readonly mediaService: MediaService,
  ) {}

  async handleKommo(body: unknown): Promise<WebhookHandleResult> {
    const candidate = extractKommoMessageCandidate(body);
    if (!candidate) {
      return { accepted: false, reason: 'not_a_message_event' };
    }

    const parsed = kommoInboundMessageSchema.safeParse(candidate);
    if (!parsed.success) {
      this.logger.warn('Webhook Kommo con message[add] inválido');
      return { accepted: false, reason: 'invalid_message' };
    }

    if (!isCustomerInbound(parsed.data)) {
      return { accepted: false, reason: 'ignored_not_inbound' };
    }

    const contactId = parsed.data.contactId || parsed.data.leadId;
    const claim = await this.inboxService.claimMessage(
      contactId,
      parsed.data.messageId,
    );
    if (claim === 'duplicate') {
      return { accepted: false, reason: 'duplicate' };
    }
    if (claim === 'unavailable') {
      return { accepted: false, reason: 'inbox_unavailable' };
    }

    const route = routeByOrigin(parsed.data.origin);

    if (route === 'waba') {
      const stopped = await this.crmService.isLeadBotStopped(parsed.data.leadId);
      if (stopped) {
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

    this.logger.log(
      `Mensaje aceptado messageId=${parsed.data.messageId} leadId=${parsed.data.leadId} route=${route} kind=${kind} debounce=${debounce}`,
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
