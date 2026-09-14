import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { redisConnectionFromUrl } from './redis-connection';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnectionFromUrl(
          config.get<string>('redis.url') ?? 'redis://127.0.0.1:6379',
        ),
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
