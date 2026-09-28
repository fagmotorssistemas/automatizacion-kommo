import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CatalogModule } from '../catalog/catalog.module';
import { CrmModule } from '../crm/crm.module';
import { OutboundModule } from '../outbound/outbound.module';
import { SUPABASE_CONFIG } from '../persistence/supabase.config';
import { VacanteRepository } from './vacante.repository';
import { VacanteService } from './vacante.service';

@Module({
  imports: [CrmModule, CatalogModule, OutboundModule],
  providers: [
    {
      provide: SUPABASE_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        url: config.get<string>('supabase.url') ?? '',
        serviceRoleKey: config.get<string>('supabase.serviceRoleKey') ?? '',
      }),
    },
    VacanteRepository,
    VacanteService,
  ],
  exports: [VacanteService],
})
export class VacanteModule {}
