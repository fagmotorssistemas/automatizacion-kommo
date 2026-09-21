import { Module } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { QueueModule } from '../../common/queue/queue.module';
import { RedisModule } from '../../common/redis/redis.module';
import { AgentModule } from '../agent/agent.module';
import { ConversationModule } from '../conversation/conversation.module';
import { CrmModule } from '../crm/crm.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { OutboundModule } from '../outbound/outbound.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { RunLogModule } from '../runs/run-log.module';
import { InboxDebounceProcessor } from './inbox-debounce.processor';
import { OtherChannelService } from './other-channel.service';
import {
  INBOX_DEBOUNCE_QUEUE,
  INBOX_DEBOUNCE_QUEUE_CLIENT,
  INBOX_FLUSH,
  InboxDebounceJobData,
} from './inbox-debounce.queue';
import { InboxService } from './inbox.service';

@Module({
  imports: [
    RedisModule,
    QueueModule,
    PersistenceModule,
    CrmModule,
    RunLogModule,
    ConversationModule,
    AgentModule,
    OutboundModule,
    IntelligenceModule,
    BullModule.registerQueue({ name: INBOX_DEBOUNCE_QUEUE }),
  ],
  providers: [
    {
      provide: INBOX_DEBOUNCE_QUEUE_CLIENT,
      inject: [getQueueToken(INBOX_DEBOUNCE_QUEUE)],
      useFactory: (queue: Queue<InboxDebounceJobData>) => queue,
    },
    InboxService,
    OtherChannelService,
    InboxDebounceProcessor,
    {
      provide: INBOX_FLUSH,
      useExisting: InboxDebounceProcessor,
    },
  ],
  exports: [InboxService],
})
export class InboxModule {}
