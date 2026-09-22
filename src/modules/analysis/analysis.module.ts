import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OPENAI_AGENT_CONFIG } from '../agent/openai-agent.config';
import { SUPABASE_CONFIG } from '../persistence/supabase.config';
import { AnalysisCron } from './analysis.cron';
import { AnalysisLlmClient } from './analysis-llm.client';
import { AnalysisRepository } from './analysis.repository';
import { AnalysisService } from './analysis.service';

@Module({
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
    AnalysisRepository,
    AnalysisLlmClient,
    AnalysisService,
    AnalysisCron,
  ],
})
export class AnalysisModule {}
