import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PersistenceService } from './persistence.service';
import { SUPABASE_CONFIG } from './supabase.config';
import { SupabasePersistenceClient } from './supabase.client';
import { SUPABASE_GATEWAY } from './supabase.gateway';

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
      provide: SUPABASE_GATEWAY,
      inject: [SUPABASE_CONFIG],
      useFactory: (config: {
        url: string;
        serviceRoleKey: string;
      }) => {
        if (!config.url || !config.serviceRoleKey) {
          return null;
        }
        return new SupabasePersistenceClient(config);
      },
    },
    PersistenceService,
  ],
  exports: [PersistenceService, SUPABASE_GATEWAY],
})
export class PersistenceModule {}
