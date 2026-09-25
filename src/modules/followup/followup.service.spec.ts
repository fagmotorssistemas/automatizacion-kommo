import { LEAD_SEND_GAP_MS } from '../outbound/outbound.constants';
import { FollowupService } from './followup.service';
import type { DueFollowupRow } from './followup.repository';

describe('FollowupService envíos separados', () => {
  const repository = {
    isReady: jest.fn(),
    listDue: jest.fn(),
    markSent: jest.fn(),
    markCancelled: jest.fn(),
  };
  const llm = {
    isReady: jest.fn(),
    draft: jest.fn(),
  };
  const crm = {
    setSeguimientoRespuesta: jest.fn(),
    runSalesbot: jest.fn(),
  };
  const outboundConfig = { shadowMode: false };

  const service = new FollowupService(
    repository as never,
    llm as never,
    crm as never,
    outboundConfig,
  );

  function dueRow(id: number, leadIdKommo: string): DueFollowupRow {
    return {
      id,
      leadId: id,
      sessionId: String(id),
      retoma: 1,
      programada: new Date('2026-09-25T10:00:00-05:00'),
      createdAt: new Date('2026-09-25T09:00:00-05:00'),
      leadIdKommo,
      seguimiento: 'activo',
      etapaMax: 2,
      objecionPrincipal: null,
      resumen: 'vio un sportage',
      vehiculos: ['Sportage'],
      objecionTexto: null,
      objecionEvidencia: null,
      presupuesto: null,
      stop: false,
      botApagado: false,
      lastHumanAt: null,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    outboundConfig.shadowMode = false;
    repository.isReady.mockReturnValue(true);
    llm.isReady.mockReturnValue(true);
    repository.listDue.mockReset();
    repository.markSent.mockReset();
    repository.markCancelled.mockReset();
    repository.markSent.mockResolvedValue(undefined);
    repository.markCancelled.mockResolvedValue(undefined);
    llm.draft.mockReset();
    llm.draft.mockResolvedValue('¿Qué le pareció el Sportage?');
    crm.setSeguimientoRespuesta.mockReset();
    crm.runSalesbot.mockReset();
    crm.setSeguimientoRespuesta.mockResolvedValue(true);
    crm.runSalesbot.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('espera 20s entre salesbots de leads distintos', async () => {
    repository.listDue.mockResolvedValue([
      dueRow(1, '42010527'),
      dueRow(2, '42016825'),
    ]);
    const times: number[] = [];
    crm.runSalesbot.mockImplementation(async () => {
      times.push(Date.now());
      return true;
    });

    const pending = service.runOnce();
    await jest.advanceTimersByTimeAsync(LEAD_SEND_GAP_MS - 1);
    expect(times).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);
    const result = await pending;

    expect(result.sent).toBe(2);
    expect(times).toHaveLength(2);
    expect(times[1] - times[0]).toBe(LEAD_SEND_GAP_MS);
    expect(crm.runSalesbot).toHaveBeenNthCalledWith(1, 180011, '42010527');
    expect(crm.runSalesbot).toHaveBeenNthCalledWith(2, 180011, '42016825');
  });

  it('un solo lead no espera al terminar', async () => {
    repository.listDue.mockResolvedValue([dueRow(1, '42010527')]);

    let settled = false;
    const pending = service.runOnce().then((result) => {
      settled = true;
      return result;
    });
    await jest.advanceTimersByTimeAsync(0);

    expect(settled).toBe(true);
    await expect(pending).resolves.toEqual(
      expect.objectContaining({ sent: 1, examined: 1 }),
    );
  });

  it('en sombra no separa los envíos porque no salen a WhatsApp', async () => {
    outboundConfig.shadowMode = true;
    repository.listDue.mockResolvedValue([
      dueRow(1, '42010527'),
      dueRow(2, '42016825'),
    ]);

    let settled = false;
    const pending = service.runOnce().then((result) => {
      settled = true;
      return result;
    });
    await jest.advanceTimersByTimeAsync(0);

    expect(settled).toBe(true);
    const result = await pending;
    expect(result.shadowed).toBe(2);
    expect(crm.runSalesbot).not.toHaveBeenCalled();
  });
});
