import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OPENAI_AGENT_CONFIG } from '../agent/openai-agent.config';
import { CrmModule } from '../crm/crm.module';
import { OutboundModule } from '../outbound/outbound.module';
import { SUPABASE_CONFIG } from '../persistence/supabase.config';
import { PostFotosCron } from './post-fotos.cron';
import { PostFotosLlmClient } from './post-fotos-llm.client';
import { PostFotosRepository } from './post-fotos.repository';
import { PostFotosService } from './post-fotos.service';

@Module({
  imports: [CrmModule, OutboundModule],
  providers: [
    {
      provide: SUPABASE_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        url: config.get<string>('supabase.url') ?? '',
        serviceRoleKey: config.get<string>('supabase.serviceRoleKey') ?? '',
      }),
    },
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
    PostFotosRepository,
    PostFotosLlmClient,
    PostFotosService,
    PostFotosCron,
  ],
  exports: [PostFotosService],
})
export class PostFotosModule {}
