import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { POST_FOTOS_INTERVAL_MS } from './post-fotos.constants';
import { PostFotosService } from './post-fotos.service';

@Injectable()
export class PostFotosCron implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostFotosCron.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly postFotos: PostFotosService) {}

  onModuleInit(): void {
    if (process.env.JEST_WORKER_ID) {
      return;
    }

    this.timer = setInterval(() => {
      void this.postFotos.runOnce().catch((error: unknown) => {
        this.logger.error(
          `Cron post-fotos: ${error instanceof Error ? error.message : error}`,
        );
      });
    }, POST_FOTOS_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
