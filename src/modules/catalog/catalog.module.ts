import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { CatalogService } from './catalog.service';

@Module({
  imports: [PersistenceModule],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
