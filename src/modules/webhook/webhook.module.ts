import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { HandoffModule } from '../handoff/handoff.module';
import { InboxModule } from '../inbox/inbox.module';
import { MediaModule } from '../media/media.module';
import { RunLogModule } from '../runs/run-log.module';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [InboxModule, CrmModule, HandoffModule, MediaModule, RunLogModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
