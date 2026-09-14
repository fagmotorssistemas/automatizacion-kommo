import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AgentService } from '../agent/agent.service';
import { ConversationService } from '../conversation/conversation.service';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { OutboundService } from '../outbound/outbound.service';
import { PersistenceService } from '../persistence/persistence.service';
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
  ) {
    super();
  }

  async process(job: Job<InboxDebounceJobData>): Promise<void> {
    const result = await this.inboxService.flushIfLatest(
      job.data.contactId,
      job.data.messageId,
    );

    if (result.status !== 'won') {
      this.logger.debug(
        `Debounce ${result.status} contactId=${job.data.contactId} messageId=${job.data.messageId}`,
      );
      return;
    }

    this.logger.log(
      `Debounce ganó contactId=${job.data.contactId} messageId=${job.data.messageId}`,
    );

    const synced = await this.persistenceService.syncInboundLead({
      contactId: job.data.contactId,
      leadIdKommo: job.data.leadId,
      name: job.data.name,
      phone: job.data.phone,
      source: job.data.source,
    });

    const inbound = this.conversationService.resolveInboundText({
      joinedText: result.text,
      createdAtUnix: job.data.createdAt,
      ctwa: synced.ctwa,
    });

    this.logger.log(
      `Lead ${synced.lead.status} contactId=${job.data.contactId} ctwa=${synced.ctwa.matched} texto=${inbound.source}`,
    );

    if (!inbound.message) {
      return;
    }

    if (
      await this.inboxService.hasOutboundSent(
        job.data.contactId,
        job.data.messageId,
      )
    ) {
      this.logger.log(
        `Outbound ya enviado contactId=${job.data.contactId} messageId=${job.data.messageId}`,
      );
      return;
    }

    const turn = await this.agentService.handleTurn({
      contactId: job.data.contactId,
      customerText: inbound.message,
    });

    if (!turn) {
      return;
    }

    await this.outboundService.dispatch(job.data.leadId, turn.reply);
    await this.inboxService.markOutboundSent(
      job.data.contactId,
      job.data.messageId,
    );

    const storedLead =
      synced.lead.status === 'created' || synced.lead.status === 'existing'
        ? synced.lead.lead
        : null;

    try {
      await this.intelligenceService.afterReply({
        contactId: job.data.contactId,
        leadId: job.data.leadId,
        lead: storedLead,
        customerText: inbound.message,
        resumen: turn.resumen,
        reply: turn.reply,
      });
    } catch (error) {
      this.logger.error(
        `Señales fallaron lead=${job.data.leadId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
