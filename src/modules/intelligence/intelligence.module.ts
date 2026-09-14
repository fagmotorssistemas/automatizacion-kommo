import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { ConversationModule } from '../conversation/conversation.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { IntelligenceService } from './intelligence.service';

@Module({
  imports: [AgentModule, ConversationModule, PersistenceModule],
  providers: [IntelligenceService],
  exports: [IntelligenceService],
})
export class IntelligenceModule {}
