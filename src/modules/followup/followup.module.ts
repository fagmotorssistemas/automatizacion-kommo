import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OPENAI_AGENT_CONFIG } from '../agent/openai-agent.config';
import { CrmModule } from '../crm/crm.module';
import { OUTBOUND_CONFIG, parseShadowMode } from '../outbound/outbound.config';
import { SUPABASE_CONFIG } from '../persistence/supabase.config';
import { FollowupCron } from './followup.cron';
import { FollowupLlmClient } from './followup-llm.client';
import { FollowupRepository } from './followup.repository';
import { FollowupService } from './followup.service';

@Module({
  imports: [CrmModule],
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
    {
      provide: OUTBOUND_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        shadowMode:
          config.get<boolean>('shadowMode') ??
          parseShadowMode(process.env.SHADOW_MODE),
      }),
    },
    FollowupRepository,
    FollowupLlmClient,
    FollowupService,
    FollowupCron,
  ],
  exports: [FollowupService],
})
export class FollowupModule {}
