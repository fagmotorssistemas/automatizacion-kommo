import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InboxFlushRunner } from './inbox-flush.runner';
import {
  INBOX_DEBOUNCE_QUEUE,
  InboxDebounceJobData,
} from './inbox-debounce.queue';

@Processor(INBOX_DEBOUNCE_QUEUE)
export class InboxDebounceProcessor extends WorkerHost {
  constructor(private readonly flush: InboxFlushRunner) {
    super();
  }

  async process(job: Job<InboxDebounceJobData>): Promise<void> {
    await this.flush.run(job.data);
  }
}
