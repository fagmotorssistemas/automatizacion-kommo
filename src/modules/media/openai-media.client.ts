import { Inject, Injectable, Logger } from '@nestjs/common';
import OpenAI, { toFile } from 'openai';
import {
  OPENAI_MEDIA_CONFIG,
  type OpenAiMediaConfig,
} from './openai-media.config';
import { vehicleImagePrompt } from './vehicle-image.prompt';
import { looksLikeAudio, prepareWhisperUpload } from './whisper-audio';

@Injectable()
export class OpenAiMediaClient {
  private readonly logger = new Logger(OpenAiMediaClient.name);
  private readonly openai: OpenAI | null;

  constructor(
    @Inject(OPENAI_MEDIA_CONFIG) config: OpenAiMediaConfig,
  ) {
    this.openai = config.apiKey ? new OpenAI({ apiKey: config.apiKey }) : null;
  }

  async transcribe(
    file: Buffer,
    fileName: string,
    link = '',
  ): Promise<string | null> {
    if (!this.openai) {
      this.logger.warn('OPENAI_API_KEY vacío; no se transcribe');
      return null;
    }

    if (!looksLikeAudio(file)) {
      this.logger.warn(
        `Adjunto de voz no es audio (${file.length} bytes); se omite Whisper`,
      );
      return null;
    }

    const prepared = await prepareWhisperUpload(file, fileName, link);
    const upload = await toFile(prepared.file, prepared.fileName);
    const result = await this.openai.audio.transcriptions.create({
      file: upload,
      model: 'whisper-1',
    });

    return result.text?.trim() || null;
  }

  async analyzeVehicleImage(
    file: Buffer,
    mensaje: string,
  ): Promise<string | null> {
    if (!this.openai) {
      this.logger.warn('OPENAI_API_KEY vacío; no se analiza la foto');
      return null;
    }

    const image = `data:image/jpeg;base64,${file.toString('base64')}`;
    const result = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: vehicleImagePrompt(mensaje) },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ],
    });

    return result.choices[0]?.message?.content?.trim() || null;
  }
}
