import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CatalogModule } from '../catalog/catalog.module';
import { ConversationModule } from '../conversation/conversation.module';
import { AgentService } from './agent.service';
import { OpenAiAgentClient } from './openai-agent.client';
import { OPENAI_AGENT_CONFIG } from './openai-agent.config';

@Module({
  imports: [CatalogModule, ConversationModule],
  providers: [
    {
      provide: OPENAI_AGENT_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        apiKey: config.get<string>('openai.apiKey') ?? '',
        model: config.get<string>('openai.model') ?? 'gpt-4.1-mini',
        embeddingModel:
          config.get<string>('openai.embeddingModel') ?? 'text-embedding-3-small',
      }),
    },
    OpenAiAgentClient,
    AgentService,
  ],
  exports: [AgentService, OpenAiAgentClient],
})
export class AgentModule {}
