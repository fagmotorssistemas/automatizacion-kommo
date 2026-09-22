import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { QueueModule } from './common/queue/queue.module';
import { HealthModule } from './health/health.module';
import { AgentModule } from './modules/agent/agent.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { CrmModule } from './modules/crm/crm.module';
import { HandoffModule } from './modules/handoff/handoff.module';
import { InboxModule } from './modules/inbox/inbox.module';
import { IntelligenceModule } from './modules/intelligence/intelligence.module';
import { MediaModule } from './modules/media/media.module';
import { OutboundModule } from './modules/outbound/outbound.module';
import { PersistenceModule } from './modules/persistence/persistence.module';
import { FollowupModule } from './modules/followup/followup.module';
import { WebhookModule } from './modules/webhook/webhook.module';

@Module({
  imports: [
    AppConfigModule,
    QueueModule,
    HealthModule,
    WebhookModule,
    InboxModule,
    MediaModule,
    ConversationModule,
    AgentModule,
    OutboundModule,
    CatalogModule,
    IntelligenceModule,
    PersistenceModule,
    CrmModule,
    HandoffModule,
    AnalysisModule,
    FollowupModule,
  ],
})
export class AppModule {}
