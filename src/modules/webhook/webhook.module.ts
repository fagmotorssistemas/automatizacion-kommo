import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { InboxModule } from '../inbox/inbox.module';
import { MediaModule } from '../media/media.module';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [InboxModule, CrmModule, MediaModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
