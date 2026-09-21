import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CatalogModule } from '../catalog/catalog.module';
import { CrmModule } from '../crm/crm.module';
import { OUTBOUND_CONFIG, parseShadowMode } from './outbound.config';
import { OutboundService } from './outbound.service';

@Module({
  imports: [CrmModule, CatalogModule],
  providers: [
    {
      provide: OUTBOUND_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        shadowMode:
          config.get<boolean>('shadowMode') ??
          parseShadowMode(process.env.SHADOW_MODE),
      }),
    },
    OutboundService,
  ],
  exports: [OutboundService],
})
export class OutboundModule {}
