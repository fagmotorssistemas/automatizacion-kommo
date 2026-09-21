import { RunLogService } from './run-log.service';

describe('RunLogService', () => {
  it('escribe en Supabase si hay gateway', async () => {
    const supabase = { insertRunLog: jest.fn().mockResolvedValue(undefined) };
    const service = new RunLogService(supabase as never);

    await service.record({
      step: 'agent',
      status: 'error',
      reason: 'openai',
      leadId: '1',
      error: 'sin key',
    });

    expect(supabase.insertRunLog).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'agent',
        status: 'error',
        reason: 'openai',
        lead_id: '1',
        error: 'sin key',
      }),
    );
  });

  it('no revienta si no hay Supabase', async () => {
    const service = new RunLogService(null);
    await expect(
      service.record({ step: 'webhook', status: 'ok' }),
    ).resolves.toBeUndefined();
  });
});
