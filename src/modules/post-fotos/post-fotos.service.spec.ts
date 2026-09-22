import { PostFotosService } from './post-fotos.service';

describe('PostFotosService', () => {
  const repository = {
    isReady: jest.fn(),
    listDue: jest.fn(),
    markMensajeEnviado: jest.fn(),
  };
  const llm = {
    isReady: jest.fn(),
    draft: jest.fn(),
  };
  const crm = {
    isLeadBotStopped: jest.fn(),
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
    leadIdKommo: 41960445,
    contactId: 59619959,
    name: 'Juan',
    brand: 'kia',
    model: 'picanto',
    year: 2023,
    price: 15990,
    mileage: 40000,
    fuelType: 'gasolina',
    color: 'blanco',
  };

  beforeEach(() => {
    repository.isReady.mockReturnValue(true);
    llm.isReady.mockReturnValue(true);
    repository.listDue.mockReset();
    repository.markMensajeEnviado.mockReset();
    llm.draft.mockReset();
    crm.isLeadBotStopped.mockReset();
    outbound.isShadowMode.mockReset();
    outbound.sendText.mockReset();
    outbound.isShadowMode.mockReturnValue(true);
  });

  it('en SHADOW marca enviado y no llama sendText', async () => {
    repository.listDue.mockResolvedValue([row]);
    crm.isLeadBotStopped.mockResolvedValue(false);
    llm.draft.mockResolvedValue('Juan, el Picanto está listo. ¿Viene al patio?');

    const result = await service.runOnce();

    expect(result).toEqual({
      examined: 1,
      sent: 0,
      failed: 0,
      shadowed: 1,
    });
    expect(repository.markMensajeEnviado).toHaveBeenCalledWith(41960445);
    expect(outbound.sendText).not.toHaveBeenCalled();
  });

  it('si bot_stopped marca y no genera texto', async () => {
    repository.listDue.mockResolvedValue([row]);
    crm.isLeadBotStopped.mockResolvedValue(true);

    const result = await service.runOnce();

    expect(result.sent).toBe(1);
    expect(llm.draft).not.toHaveBeenCalled();
    expect(repository.markMensajeEnviado).toHaveBeenCalledWith(41960445);
  });
});
