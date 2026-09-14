import {
  BUFFER_TTL_SECONDS,
  DEBOUNCE_DELAY_MS,
  MESSAGE_ID_TTL_SECONDS,
  bufferKey,
  flushJobId,
  messageIdKey,
} from './inbox.constants';
import { InboxService } from './inbox.service';
import { serializeBufferedMessage } from './debounce.buffer';

describe('InboxService', () => {
  const redis = {
    set: jest.fn(),
    multi: jest.fn(),
    lrange: jest.fn(),
    del: jest.fn(),
  };
  const queue = { add: jest.fn() };
  const pipeline = { rpush: jest.fn(), expire: jest.fn(), exec: jest.fn() };
  const service = new InboxService(redis as never, queue as never);

  beforeEach(() => {
    redis.set.mockReset();
    redis.lrange.mockReset();
    redis.del.mockReset();
    redis.multi.mockReset();
    redis.multi.mockReturnValue(pipeline);
    pipeline.rpush.mockReset();
    pipeline.rpush.mockReturnValue(pipeline);
    pipeline.expire.mockReset();
    pipeline.expire.mockReturnValue(pipeline);
    pipeline.exec.mockReset();
    pipeline.exec.mockResolvedValue([]);
    queue.add.mockReset();
    queue.add.mockResolvedValue({});
  });

  it('reclama un messageId nuevo', async () => {
    redis.set.mockResolvedValue('OK');

    await expect(service.claimMessage('c1', 'msg-1')).resolves.toBe('claimed');
    expect(redis.set).toHaveBeenCalledWith(
      messageIdKey('c1', 'msg-1'),
      '1',
      'EX',
      MESSAGE_ID_TTL_SECONDS,
      'NX',
    );
  });

  it('marca duplicado si Redis ya tenía el id', async () => {
    redis.set.mockResolvedValue(null);

    await expect(service.claimMessage('c1', 'msg-1')).resolves.toBe('duplicate');
  });

  it('no tira el proceso si Redis está caído', async () => {
    redis.set.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.claimMessage('c1', 'msg-1')).resolves.toBe('unavailable');
  });

  it('empuja el mensaje y agenda el flush a 30 s', async () => {
    await expect(
      service.scheduleDebounce({
        contactId: '59458509',
        messageId: 'msg-1',
        text: 'hola',
        leadId: '41807269',
        name: 'Rosa',
        phone: '+593999000111',
        source: 'waba',
        createdAt: '1789340833',
      }),
    ).resolves.toBe('scheduled');

    expect(pipeline.rpush).toHaveBeenCalledWith(
      bufferKey('59458509'),
      serializeBufferedMessage({
        contactId: '59458509',
        messageId: 'msg-1',
        text: 'hola',
      }),
    );
    expect(pipeline.expire).toHaveBeenCalledWith(
      bufferKey('59458509'),
      BUFFER_TTL_SECONDS,
    );
    expect(queue.add).toHaveBeenCalledWith(
      'flush',
      {
        contactId: '59458509',
        messageId: 'msg-1',
        leadId: '41807269',
        name: 'Rosa',
        phone: '+593999000111',
        source: 'waba',
        createdAt: '1789340833',
      },
      expect.objectContaining({
        delay: DEBOUNCE_DELAY_MS,
        jobId: flushJobId('59458509', 'msg-1'),
        attempts: 1,
      }),
    );
  });

  it('no agenda si falta contactId', async () => {
    await expect(
      service.scheduleDebounce({
        contactId: '',
        messageId: 'msg-1',
        text: 'hola',
        leadId: '1',
        name: 'Rosa',
        phone: null,
        source: 'waba',
        createdAt: '1',
      }),
    ).resolves.toBe('skipped');
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('gana si es el último y borra la lista', async () => {
    redis.lrange.mockResolvedValue([
      serializeBufferedMessage({ contactId: 'c1', messageId: '1', text: 'hola' }),
      serializeBufferedMessage({ contactId: 'c1', messageId: '2', text: 'hilux' }),
    ]);
    redis.del.mockResolvedValue(1);

    await expect(service.flushIfLatest('c1', '2')).resolves.toEqual({
      status: 'won',
      text: 'hola\nhilux',
    });
    expect(redis.del).toHaveBeenCalledWith(bufferKey('c1'));
  });

  it('pierde si no es el último y no borra', async () => {
    redis.lrange.mockResolvedValue([
      serializeBufferedMessage({ contactId: 'c1', messageId: '1', text: 'hola' }),
      serializeBufferedMessage({ contactId: 'c1', messageId: '2', text: 'hilux' }),
    ]);

    await expect(service.flushIfLatest('c1', '1')).resolves.toEqual({
      status: 'lost',
    });
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('al ganar no junta texto de otro contactId', async () => {
    redis.lrange.mockResolvedValue([
      serializeBufferedMessage({ contactId: 'c1', messageId: '1', text: 'rosa' }),
      serializeBufferedMessage({ contactId: 'c2', messageId: '2', text: 'otro' }),
      serializeBufferedMessage({ contactId: 'c1', messageId: '3', text: 'hilux' }),
    ]);
    redis.del.mockResolvedValue(1);

    await expect(service.flushIfLatest('c1', '3')).resolves.toEqual({
      status: 'won',
      text: 'rosa\nhilux',
    });
  });
});
