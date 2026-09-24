import { Inject, Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
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
  RECENT_OUTBOUND_TTL_SECONDS,
  TURN_LOCK_MAX_RETRIES,
  TURN_LOCK_RETRY_DELAY_MS,
  TURN_LOCK_TTL_SECONDS,
  bufferKey,
  flushDoneKey,
  flushJobId,
  messageIdKey,
  outboundSentKey,
  recentOutboundKey,
  turnLockKey,
  turnRetryJobId,
} from './inbox.constants';
import {
  INBOX_DEBOUNCE_QUEUE_CLIENT,
  INBOX_FLUSH,
  type InboxDebounceJobData,
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
  private readonly localFlushTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(INBOX_DEBOUNCE_QUEUE_CLIENT)
    private readonly debounceQueue: InboxDebounceQueue,
    private readonly moduleRef: ModuleRef,
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
    assignedTo?: string;
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

      const jobData: InboxDebounceJobData = {
        contactId: input.contactId,
        messageId: input.messageId,
        leadId: input.leadId,
        name: input.name,
        phone: input.phone,
        source: input.source,
        createdAt: input.createdAt,
        text: input.text,
        assignedTo: input.assignedTo,
      };

      await this.debounceQueue.add('flush', jobData, {
        delay: DEBOUNCE_DELAY_MS,
        jobId: flushJobId(input.contactId, input.messageId),
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: 50,
      });

      // Redis Cloud se come las keys de BullMQ (delayed queda en 0).
      // El timer del proceso sí corre; flushIfLatest evita doble envío.
      this.scheduleLocalFlush(jobData);

      return 'scheduled';
    } catch (error) {
      this.logger.error(
        `No se pudo agendar debounce contactId=${input.contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return 'skipped';
    }
  }

  private scheduleLocalFlush(data: InboxDebounceJobData): void {
    const previous = this.localFlushTimers.get(data.contactId);
    if (previous) {
      clearTimeout(previous);
    }
    this.logger.log(
      `Debounce local en ${DEBOUNCE_DELAY_MS / 1000}s contactId=${data.contactId} messageId=${data.messageId}`,
    );

    const timer = setTimeout(() => {
      this.localFlushTimers.delete(data.contactId);
      void this.runLocalFlush(data);
    }, DEBOUNCE_DELAY_MS);
    this.localFlushTimers.set(data.contactId, timer);
  }

  private async runLocalFlush(data: InboxDebounceJobData): Promise<void> {
    try {
      const flush = this.moduleRef.get<{
        run(job: InboxDebounceJobData): Promise<void>;
      }>(INBOX_FLUSH, { strict: false });
      await flush.run(data);
    } catch (error) {
      this.logger.error(
        `Flush local falló contactId=${data.contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async flushIfLatest(
    contactId: string,
    messageId: string,
    fallbackText?: string,
  ): Promise<DebounceFlushResult> {
    try {
      const claimed = await this.claimFlush(contactId, messageId);
      if (!claimed) {
        return { status: 'lost' };
      }

      const key = bufferKey(contactId);
      const raw = await this.redis.lrange(key, 0, -1);
      const items = itemsForContact(parseBufferedItems(raw), contactId);

      if (isLatestMessage(items, messageId)) {
        const text = joinBufferedTexts(items);
        await this.redis.del(key);
        return { status: 'won', text };
      }

      // Redis Cloud a veces evicta inbox:buf antes de los 30 s.
      if (items.length === 0 && fallbackText?.trim()) {
        return { status: 'won', text: fallbackText };
      }

      return { status: 'lost' };
    } catch (error) {
      this.logger.error(
        `No se pudo flush debounce contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return { status: 'unavailable' };
    }
  }

  private async claimFlush(
    contactId: string,
    messageId: string,
  ): Promise<boolean> {
    const created = await this.redis.set(
      flushDoneKey(contactId, messageId),
      '1',
      'EX',
      300,
      'NX',
    );
    return created === 'OK';
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

  async claimTurn(contactId: string): Promise<boolean> {
    if (!contactId) {
      return true;
    }
    try {
      const created = await this.redis.set(
        turnLockKey(contactId),
        '1',
        'EX',
        TURN_LOCK_TTL_SECONDS,
        'NX',
      );
      return created === 'OK';
    } catch (error) {
      this.logger.error(
        `No se pudo tomar turno contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return true;
    }
  }

  async scheduleTurnRetry(
    data: InboxDebounceJobData,
  ): Promise<DebounceScheduleResult> {
    const nextRetry = (data.lockRetry ?? 0) + 1;
    if (
      !data.contactId ||
      !data.messageId ||
      nextRetry > TURN_LOCK_MAX_RETRIES
    ) {
      return 'skipped';
    }

    const next: InboxDebounceJobData = { ...data, lockRetry: nextRetry };
    try {
      await this.debounceQueue.add('flush', next, {
        delay: TURN_LOCK_RETRY_DELAY_MS,
        jobId: turnRetryJobId(data.contactId, data.messageId, nextRetry),
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: 50,
      });
      this.scheduleLocalTurnRetry(next);
      return 'scheduled';
    } catch (error) {
      this.logger.error(
        `No se pudo agendar reintento de turno contactId=${data.contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return 'skipped';
    }
  }

  private scheduleLocalTurnRetry(data: InboxDebounceJobData): void {
    this.logger.log(
      `Reintento de turno en ${TURN_LOCK_RETRY_DELAY_MS / 1000}s contactId=${data.contactId} messageId=${data.messageId} intento=${data.lockRetry}`,
    );
    const timer = setTimeout(() => {
      void this.runLocalFlush(data);
    }, TURN_LOCK_RETRY_DELAY_MS);
    timer.unref?.();
  }

  async releaseTurn(contactId: string): Promise<void> {
    if (!contactId) {
      return;
    }
    try {
      await this.redis.del(turnLockKey(contactId));
    } catch (error) {
      this.logger.error(
        `No se pudo soltar turno contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async hasRecentOutbound(contactId: string): Promise<boolean> {
    if (!contactId) {
      return false;
    }
    try {
      return (await this.redis.exists(recentOutboundKey(contactId))) === 1;
    } catch (error) {
      this.logger.error(
        `No se pudo leer outbound reciente contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  async markRecentOutbound(contactId: string): Promise<void> {
    if (!contactId) {
      return;
    }
    try {
      await this.redis.set(
        recentOutboundKey(contactId),
        '1',
        'EX',
        RECENT_OUTBOUND_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo marcar outbound reciente contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
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
