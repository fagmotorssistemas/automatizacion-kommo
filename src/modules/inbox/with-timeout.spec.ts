import { withTimeout } from './with-timeout';
import { AGENT_TURN_TIMEOUT_MS } from './inbox.constants';

describe('withTimeout', () => {
  it('devuelve el valor si llega a tiempo', async () => {
    await expect(withTimeout(Promise.resolve(7), 50, 'test')).resolves.toBe(7);
  });

  it('corta si se pasa del tiempo', async () => {
    jest.useFakeTimers();
    const pending = withTimeout(new Promise(() => undefined), 15_000, 'intelligence');
    const assertion = expect(pending).rejects.toThrow('intelligence tardó más de 15000ms');
    await jest.advanceTimersByTimeAsync(15_000);
    await assertion;
    jest.useRealTimers();
  });

  it('handleTurn corta a los 45s y suelta el candado', async () => {
    expect(AGENT_TURN_TIMEOUT_MS).toBe(45_000);
    jest.useFakeTimers();
    const pending = withTimeout(
      new Promise(() => undefined),
      AGENT_TURN_TIMEOUT_MS,
      'handleTurn',
    );
    const assertion = expect(pending).rejects.toThrow(
      'handleTurn tardó más de 45000ms',
    );
    await jest.advanceTimersByTimeAsync(45_000);
    await assertion;
    jest.useRealTimers();
  });
});
