export const INBOX_DEBOUNCE_QUEUE = 'inbox-debounce';

export const INBOX_DEBOUNCE_QUEUE_CLIENT = 'INBOX_DEBOUNCE_QUEUE_CLIENT';

export const INBOX_FLUSH = 'INBOX_FLUSH';

export type InboxDebounceJobData = {
  contactId: string;
  messageId: string;
  leadId: string;
  name: string;
  phone: string | null;
  source: string;
  createdAt: string;
  text?: string;
  assignedTo?: string;
  /** Reintento tras turno_ocupado (1..TURN_LOCK_MAX_RETRIES). */
  lockRetry?: number;
};

/** Evita importar @nestjs/bullmq en InboxService (Jest + ESM). */
export type InboxDebounceQueue = {
  add(
    name: string,
    data: InboxDebounceJobData,
    opts: {
      delay: number;
      jobId: string;
      attempts: number;
      removeOnComplete: boolean;
      removeOnFail: number;
    },
  ): Promise<unknown>;
};
