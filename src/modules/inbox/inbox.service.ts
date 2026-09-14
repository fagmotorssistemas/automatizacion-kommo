import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.constants';
import {
  itemsForContact,
  joinBufferedTexts,
  isLatestMessage,
  parseBufferedItems,
  serializeBufferedMessage,
} from './debounce.buffer';
import {
  BUFFER_TTL_SECONDS,
  DEBOUNCE_DELAY_MS,
  MESSAGE_ID_TTL_SECONDS,
  bufferKey,
  flushJobId,
  messageIdKey,
  outboundSentKey,
} from './inbox.constants';
import {
  INBOX_DEBOUNCE_QUEUE_CLIENT,
  type InboxDebounceQueue,
} from './inbox-debounce.queue';

export type MessageClaimResult = 'claimed' | 'duplicate' | 'unavailable';

export type DebounceScheduleResult = 'scheduled' | 'skipped';

export type DebounceFlushResult =
  | { status: 'won'; text: string }
  | { status: 'lost' }
  | { status: 'unavailable' };

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(INBOX_DEBOUNCE_QUEUE_CLIENT)
    private readonly debounceQueue: InboxDebounceQueue,
  ) {}

  async claimMessage(
    contactId: string,
    messageId: string,
  ): Promise<MessageClaimResult> {
    if (!contactId || !messageId) {
      return 'unavailable';
    }

    try {
      const created = await this.redis.set(
        messageIdKey(contactId, messageId),
        '1',
        'EX',
        MESSAGE_ID_TTL_SECONDS,
        'NX',
      );

      return created === 'OK' ? 'claimed' : 'duplicate';
    } catch (error) {
      this.logger.error(
        `Redis no pudo reclamar contactId=${contactId} messageId=${messageId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return 'unavailable';
    }
  }

  /** Redis push + Wait 30 s. El perdedor no borra. */
  async scheduleDebounce(input: {
    contactId: string;
    messageId: string;
    text: string;
    leadId: string;
    name: string;
    phone: string | null;
    source: string;
    createdAt: string;
  }): Promise<DebounceScheduleResult> {
    if (!input.contactId || !input.messageId) {
      return 'skipped';
    }

    try {
      const key = bufferKey(input.contactId);
      await this.redis
        .multi()
        .rpush(
          key,
          serializeBufferedMessage({
            contactId: input.contactId,
            messageId: input.messageId,
            text: input.text,
          }),
        )
        .expire(key, BUFFER_TTL_SECONDS)
        .exec();

      await this.debounceQueue.add(
        'flush',
        {
          contactId: input.contactId,
          messageId: input.messageId,
          leadId: input.leadId,
          name: input.name,
          phone: input.phone,
          source: input.source,
          createdAt: input.createdAt,
        },
        {
          delay: DEBOUNCE_DELAY_MS,
          jobId: flushJobId(input.contactId, input.messageId),
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: 50,
        },
      );

      return 'scheduled';
    } catch (error) {
      this.logger.error(
        `No se pudo agendar debounce contactId=${input.contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return 'skipped';
    }
  }

  async flushIfLatest(
    contactId: string,
    messageId: string,
  ): Promise<DebounceFlushResult> {
    try {
      const key = bufferKey(contactId);
      const raw = await this.redis.lrange(key, 0, -1);
      const items = itemsForContact(parseBufferedItems(raw), contactId);

      if (!isLatestMessage(items, messageId)) {
        return { status: 'lost' };
      }

      const text = joinBufferedTexts(items);
      await this.redis.del(key);
      return { status: 'won', text };
    } catch (error) {
      this.logger.error(
        `No se pudo flush debounce contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return { status: 'unavailable' };
    }
  }

  async hasOutboundSent(contactId: string, messageId: string): Promise<boolean> {
    if (!contactId || !messageId) {
      return false;
    }

    try {
      const exists = await this.redis.exists(
        outboundSentKey(contactId, messageId),
      );
      return exists === 1;
    } catch (error) {
      this.logger.error(
        `No se pudo leer outbound sent contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  async markOutboundSent(contactId: string, messageId: string): Promise<void> {
    if (!contactId || !messageId) {
      return;
    }

    try {
      await this.redis.set(
        outboundSentKey(contactId, messageId),
        '1',
        'EX',
        MESSAGE_ID_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo marcar outbound sent contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
