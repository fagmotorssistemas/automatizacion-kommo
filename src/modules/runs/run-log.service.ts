import { Inject, Injectable, Logger } from '@nestjs/common';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  SUPABASE_GATEWAY,
  type SupabaseGateway,
} from '../persistence/supabase.gateway';
import { RunLogInput } from './run-log.types';

export const RUN_LOG_FILE = join(process.cwd(), 'logs', 'automation-runs.jsonl');

@Injectable()
export class RunLogService {
  private readonly logger = new Logger(RunLogService.name);

  constructor(
    @Inject(SUPABASE_GATEWAY) private readonly supabase: SupabaseGateway | null,
  ) {}

  async record(input: RunLogInput): Promise<void> {
    const line = {
      created_at: new Date().toISOString(),
      contact_id: input.contactId ?? null,
      lead_id: input.leadId ?? null,
      message_id: input.messageId ?? null,
      step: input.step,
      status: input.status,
      reason: input.reason ?? null,
      detail: input.detail ?? {},
      error: input.error ?? null,
    };

    const prefix = `[${input.status.toUpperCase()}] ${input.step}${
      input.reason ? ` (${input.reason})` : ''
    }`;
    if (input.status === 'error') {
      this.logger.error(`${prefix} ${input.error ?? ''}`.trim());
    } else {
      this.logger.log(prefix);
    }

    await Promise.allSettled([this.writeFile(line), this.writeSupabase(line)]);
  }

  private async writeFile(line: Record<string, unknown>): Promise<void> {
    if (process.env.JEST_WORKER_ID) {
      return;
    }

    await mkdir(join(process.cwd(), 'logs'), { recursive: true });
    await appendFile(RUN_LOG_FILE, `${JSON.stringify(line)}\n`, 'utf8');
  }

  private async writeSupabase(line: {
    created_at: string;
    contact_id: string | null;
    lead_id: string | null;
    message_id: string | null;
    step: string;
    status: string;
    reason: string | null;
    detail: Record<string, unknown>;
    error: string | null;
  }): Promise<void> {
    if (!this.supabase) {
      return;
    }

    await this.supabase.insertRunLog(line);
  }
}
