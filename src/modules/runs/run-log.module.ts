import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { RunLogService } from './run-log.service';

@Module({
  imports: [PersistenceModule],
  providers: [RunLogService],
  exports: [RunLogService],
})
export class RunLogModule {}
