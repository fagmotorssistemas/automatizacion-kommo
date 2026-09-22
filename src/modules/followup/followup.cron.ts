import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FOLLOWUP_INTERVAL_MS } from './followup.constants';
import { FollowupService } from './followup.service';

@Injectable()
export class FollowupCron implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FollowupCron.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly followup: FollowupService) {}

  onModuleInit(): void {
    if (process.env.JEST_WORKER_ID) {
      return;
    }

    this.timer = setInterval(() => {
      void this.followup.runOnce().catch((error: unknown) => {
        this.logger.error(
          `Cron de followup: ${error instanceof Error ? error.message : error}`,
        );
      });
    }, FOLLOWUP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
