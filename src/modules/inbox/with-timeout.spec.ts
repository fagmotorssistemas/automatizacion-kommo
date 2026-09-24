import { withTimeout } from './with-timeout';

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
});
