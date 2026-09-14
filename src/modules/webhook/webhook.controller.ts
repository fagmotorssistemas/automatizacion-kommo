import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('kommo')
  @HttpCode(200)
  receiveKommo(@Body() body: Record<string, unknown>) {
    return this.webhookService.handleKommo(body);
  }
}
