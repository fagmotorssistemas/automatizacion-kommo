import { ConversationService } from './conversation.service';

describe('ConversationService', () => {
  const stored: string[] = [];
  const redis = {
    get: jest.fn(async () => null),
    set: jest.fn(async () => 'OK'),
    lrange: jest.fn(async () => [...stored]),
    multi: jest.fn(() => {
      const chain = {
        rpush: jest.fn().mockReturnThis(),
        ltrim: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn(async () => {
          return [];
        }),
      };
      return chain;
    }),
  };
  const service = new ConversationService(redis as never);

  beforeEach(() => {
    stored.length = 0;
    redis.lrange.mockClear();
    redis.multi.mockClear();
    redis.get.mockReset();
    redis.get.mockResolvedValue(null);
    redis.set.mockReset();
    redis.set.mockResolvedValue('OK');
  });

  it('al leer descarta el RESUMEN PREVIO guardado como user', async () => {
    stored.push(
      JSON.stringify({ role: 'user', content: 'hola' }),
      JSON.stringify({
        role: 'user',
        content: 'RESUMEN PREVIO:\nVehículo: Hilux',
      }),
      JSON.stringify({ role: 'assistant', content: 'Tenemos una Hilux.' }),
    );

    await expect(service.recentMessages('1')).resolves.toEqual([
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: 'Tenemos una Hilux.' },
    ]);
  });

  it('no vuelve a persistir un RESUMEN PREVIO como user', async () => {
    const chain = {
      rpush: jest.fn().mockReturnThis(),
      ltrim: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn(async () => []),
    };
    redis.multi.mockReturnValue(chain);

    await service.appendMessages('1', [
      { role: 'user', content: 'RESUMEN PREVIO:\nVehículo: Hilux' },
      { role: 'user', content: 'me interesa' },
    ]);

    expect(chain.rpush).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify({ role: 'user', content: 'me interesa' }),
    );
  });

  it('guarda unidadesPresentadas con el TTL de la conversación', async () => {
    const turno = [
      { inventory_id: 'xt-2016', orden: 1, como: 'lista' as const },
      { inventory_id: 'kicks-2020', orden: 2, como: 'lista' as const },
    ];
    redis.get.mockResolvedValueOnce(null);

    await expect(
      service.recordUnidadesPresentadas('59825503', turno),
    ).resolves.toEqual([turno]);

    expect(redis.set).toHaveBeenCalledWith(
      'conversation:unidades-presentadas:59825503',
      JSON.stringify([turno]),
      'EX',
      7 * 24 * 60 * 60,
    );
  });
});
