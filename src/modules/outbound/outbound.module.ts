import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { CrmModule } from '../crm/crm.module';
import { OutboundService } from './outbound.service';

@Module({
  imports: [CrmModule, CatalogModule],
  providers: [OutboundService],
  exports: [OutboundService],
})
export class OutboundModule {}
