import { Module } from '@nestjs/common';
import { RedisModule } from '../../common/redis/redis.module';
import { ConversationService } from './conversation.service';

@Module({
  imports: [RedisModule],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
