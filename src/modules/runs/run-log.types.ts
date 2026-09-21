export type RunLogStatus = 'ok' | 'skipped' | 'error';

export type RunLogInput = {
  contactId?: string;
  leadId?: string;
  messageId?: string;
  step: string;
  status: RunLogStatus;
  reason?: string;
  detail?: Record<string, unknown>;
  error?: string;
};
