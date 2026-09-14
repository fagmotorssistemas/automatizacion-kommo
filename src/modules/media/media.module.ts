import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaService } from './media.service';
import { OpenAiMediaClient } from './openai-media.client';
import { OPENAI_MEDIA_CONFIG } from './openai-media.config';

@Module({
  providers: [
    {
      provide: OPENAI_MEDIA_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        apiKey: config.get<string>('openai.apiKey') ?? '',
      }),
    },
    OpenAiMediaClient,
    MediaService,
  ],
  exports: [MediaService],
})
export class MediaModule {}
