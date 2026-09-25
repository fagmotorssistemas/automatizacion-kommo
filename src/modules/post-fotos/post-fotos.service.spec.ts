import { LEAD_SEND_GAP_MS } from '../outbound/outbound.constants';
import { PostFotosService } from './post-fotos.service';

describe('PostFotosService', () => {
  const repository = {
    isReady: jest.fn(),
    hasPending: jest.fn(),
    schedulePaso: jest.fn(),
    cancelPending: jest.fn(),
    listDue: jest.fn(),
    markSent: jest.fn(),
    markCancelled: jest.fn(),
    markMensajePostFotosFlag: jest.fn(),
  };
  const llm = {
    isReady: jest.fn(),
    draft: jest.fn(),
  };
  const crm = {
    inspectLead: jest.fn(),
  };
  const outbound = {
    isShadowMode: jest.fn(),
    sendText: jest.fn(),
  };

  const service = new PostFotosService(
    repository as never,
    llm as never,
    crm as never,
    outbound as never,
  );

  const row = {
    id: 10,
    leadId: 1,
    sessionId: '59619959',
    paso: 1 as const,
    programada: new Date(),
    leadIdKommo: '41960445',
    contactId: 59619959,
    name: 'Juan',
    brand: 'kia',
    model: 'picanto',
    year: 2023,
    price: 15990,
    mileage: 40000,
    fuelType: 'gasolina',
    color: 'blanco',
    botApagado: false,
    respondioPostFotos: false,
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    repository.isReady.mockReturnValue(true);
    llm.isReady.mockReturnValue(true);
    for (const fn of Object.values(repository)) {
      fn.mockReset();
    }
    repository.isReady.mockReturnValue(true);
    llm.draft.mockReset();
    crm.inspectLead.mockReset();
    crm.inspectLead.mockResolvedValue({ stopped: false, raw: { id: 1 } });
    outbound.isShadowMode.mockReset();
    outbound.sendText.mockReset();
    outbound.isShadowMode.mockReturnValue(true);
    repository.hasPending.mockResolvedValue(false);
    repository.listDue.mockResolvedValue([]);
    repository.cancelPending.mockResolvedValue(0);
  });

  it('scheduleAfterPhotos programa paso 1 si no hay pendientes', async () => {
    await service.scheduleAfterPhotos({
      sessionId: '59619959',
      leadId: 1,
      fotosEnviadasAt: new Date('2026-09-22T15:00:00-05:00'),
    });
    expect(repository.schedulePaso).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: '59619959',
        paso: 1,
        leadId: 1,
      }),
    );
  });

  it('onCustomerMessage cancela pendientes', async () => {
    repository.cancelPending.mockResolvedValue(2);
    await service.onCustomerMessage('59619959');
    expect(repository.cancelPending).toHaveBeenCalledWith(
      '59619959',
      'cliente_escribio',
    );
  });

  it('en SHADOW marca enviado y programa paso 2', async () => {
    repository.listDue.mockResolvedValue([row]);
    llm.draft.mockResolvedValue('Juan, ¿qué le pareció el Picanto?');

    const result = await service.runOnce();

    expect(result.shadowed).toBe(1);
    expect(repository.markSent).toHaveBeenCalled();
    expect(repository.schedulePaso).toHaveBeenCalledWith(
      expect.objectContaining({ paso: 2, sessionId: '59619959' }),
    );
    expect(outbound.sendText).not.toHaveBeenCalled();
  });

  it('si Kommo no deja escribir Respuesta IA, cancela y no reintenta', async () => {
    repository.listDue.mockResolvedValue([row]);
    outbound.isShadowMode.mockReturnValue(false);
    llm.draft.mockResolvedValue('Juan, ¿le gustó el Picanto?');
    outbound.sendText.mockResolvedValue({ wrote: false, botRan: false });

    const result = await service.runOnce();

    expect(result.cancelled).toBe(1);
    expect(result.failed).toBe(0);
    expect(repository.markCancelled).toHaveBeenCalledWith(
      10,
      'kommo_respuesta_ia',
    );
    expect(repository.schedulePaso).not.toHaveBeenCalled();
  });

  it('espera 20s entre mensajes a leads distintos', async () => {
    jest.useFakeTimers();
    const second = { ...row, id: 11, leadIdKommo: '42016825', sessionId: '2' };
    repository.listDue.mockResolvedValue([row, second]);
    outbound.isShadowMode.mockReturnValue(false);
    llm.draft.mockResolvedValue('Juan, ¿qué le pareció el Picanto?');
    const times: number[] = [];
    outbound.sendText.mockImplementation(async () => {
      times.push(Date.now());
      return { wrote: true, botRan: true };
    });

    const pending = service.runOnce();
    await jest.advanceTimersByTimeAsync(LEAD_SEND_GAP_MS - 1);
    expect(times).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);
    const result = await pending;

    expect(result.sent).toBe(2);
    expect(times[1] - times[0]).toBe(LEAD_SEND_GAP_MS);
  });

  it('si el lead ya no está en Kommo, cancela', async () => {
    repository.listDue.mockResolvedValue([row]);
    crm.inspectLead.mockResolvedValue({ stopped: false, raw: null });

    const result = await service.runOnce();

    expect(result.cancelled).toBe(1);
    expect(repository.markCancelled).toHaveBeenCalledWith(
      10,
      'lead_kommo_inexistente',
    );
    expect(llm.draft).not.toHaveBeenCalled();
  });
});
