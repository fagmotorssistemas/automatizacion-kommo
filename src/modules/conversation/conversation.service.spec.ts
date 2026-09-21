import { ConversationService } from './conversation.service';

describe('ConversationService', () => {
  const stored: string[] = [];
  const redis = {
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
});
