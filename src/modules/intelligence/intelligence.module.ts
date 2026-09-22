import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { ConversationModule } from '../conversation/conversation.module';
import { FollowupModule } from '../followup/followup.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { IntelligenceService } from './intelligence.service';

@Module({
  imports: [AgentModule, ConversationModule, PersistenceModule, FollowupModule],
  providers: [IntelligenceService],
  exports: [IntelligenceService],
})
export class IntelligenceModule {}
