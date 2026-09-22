import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ANALYSIS_INTERVAL_MS } from './analysis.constants';
import { AnalysisService } from './analysis.service';

@Injectable()
export class AnalysisCron implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalysisCron.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly analysis: AnalysisService) {}

  onModuleInit(): void {
    if (process.env.JEST_WORKER_ID) {
      return;
    }

    this.timer = setInterval(() => {
      void this.analysis.runOnce().catch((error: unknown) => {
        this.logger.error(
          `Cron de análisis: ${error instanceof Error ? error.message : error}`,
        );
      });
    }, ANALYSIS_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
