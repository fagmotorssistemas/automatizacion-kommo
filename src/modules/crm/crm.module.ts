import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrmService } from './crm.service';
import { KommoClient } from './kommo.client';
import { KOMMO_CONFIG } from './kommo.config';

@Module({
  providers: [
    {
      provide: KOMMO_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseUrl: config.get<string>('kommo.baseUrl') ?? '',
        token: config.get<string>('kommo.token') ?? '',
      }),
    },
    KommoClient,
    CrmService,
  ],
  exports: [CrmService],
})
export class CrmModule {}
