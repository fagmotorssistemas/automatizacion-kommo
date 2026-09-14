import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.constants';
import { CtwaMatch } from '../persistence/lead.types';
import {
  MEMORY_MAX_MESSAGES,
  MEMORY_TTL_SECONDS,
  memoryKey,
} from './conversation.constants';
import {
  InboundTextResult,
  resolveInboundText,
} from './resolve-inbound-text';

export type MemoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  resolveInboundText(input: {
    joinedText: string;
    createdAtUnix: string;
    ctwa: CtwaMatch;
  }): InboundTextResult {
    return resolveInboundText(input);
  }

  async recentMessages(contactId: string): Promise<MemoryMessage[]> {
    if (!contactId) {
      return [];
    }

    try {
      const raw = await this.redis.lrange(memoryKey(contactId), 0, -1);
      return raw
        .map((row) => {
          try {
            return JSON.parse(row) as MemoryMessage;
          } catch {
            return null;
          }
        })
        .filter((item): item is MemoryMessage => Boolean(item?.role && item.content));
    } catch (error) {
      this.logger.error(
        `No se pudo leer memoria contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return [];
    }
  }

  async appendMessage(
    contactId: string,
    message: MemoryMessage,
  ): Promise<void> {
    if (!contactId || !message.content) {
      return;
    }

    try {
      const key = memoryKey(contactId);
      await this.redis
        .multi()
        .rpush(key, JSON.stringify(message))
        .ltrim(key, -MEMORY_MAX_MESSAGES, -1)
        .expire(key, MEMORY_TTL_SECONDS)
        .exec();
    } catch (error) {
      this.logger.error(
        `No se pudo guardar memoria contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
