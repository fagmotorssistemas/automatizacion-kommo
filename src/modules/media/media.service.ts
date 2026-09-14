import { Injectable, Logger } from '@nestjs/common';
import { MessageKind } from './classify-message-kind';
import { downloadAttachment } from './download-attachment';
import { OpenAiMediaClient } from './openai-media.client';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(private readonly openai: OpenAiMediaClient) {}

  async toCustomerText(input: {
    kind: MessageKind;
    text: string;
    attachmentLink: string;
    attachmentFileName: string;
  }): Promise<string> {
    if (input.kind === 'text') {
      return input.text;
    }

    const file = await downloadAttachment(input.attachmentLink);
    if (!file) {
      this.logger.warn(`No se pudo bajar el adjunto kind=${input.kind}`);
      return input.text;
    }

    try {
      if (input.kind === 'voice') {
        return (
          (await this.openai.transcribe(file, input.attachmentFileName)) ??
          input.text
        );
      }

      return (
        (await this.openai.analyzeVehicleImage(file, input.text)) ?? input.text
      );
    } catch (error) {
      this.logger.error(
        `Fallo OpenAI en kind=${input.kind}`,
        error instanceof Error ? error.stack : undefined,
      );
      return input.text;
    }
  }
}
