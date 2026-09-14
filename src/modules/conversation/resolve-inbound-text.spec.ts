import { resolveInboundText } from './resolve-inbound-text';

describe('resolveInboundText', () => {
  const joined = 'hola\nme interesa esto';

  it('sin match deja la cadena del debounce', () => {
    expect(
      resolveInboundText({
        joinedText: joined,
        createdAtUnix: '1000',
        ctwa: { matched: false, adHeadline: 'Hilux', capturedAt: null },
      }),
    ).toEqual({
      message: joined,
      source: 'buffer',
      vehicle: null,
      withinWindow: false,
    });
  });

  it('match fuera de 60 s no anota el vehículo', () => {
    expect(
      resolveInboundText({
        joinedText: joined,
        createdAtUnix: '1000',
        ctwa: {
          matched: true,
          adHeadline: 'Hilux 2022',
          capturedAt: new Date(1000 * 1000 + 120_000).toISOString(),
        },
      }).source,
    ).toBe('buffer');
  });

  it('match reciente reemplaza "esto" por el vehículo', () => {
    expect(
      resolveInboundText({
        joinedText: joined,
        createdAtUnix: '1000',
        ctwa: {
          matched: true,
          adHeadline: 'Hilux 2022',
          capturedAt: new Date(1000 * 1000 + 10_000).toISOString(),
        },
      }),
    ).toEqual({
      message: 'hola\nme interesa esto {Hilux 2022}',
      source: 'ad',
      vehicle: 'Hilux 2022',
      withinWindow: true,
    });
  });

  it('match reciente sin "esto" concatena el vehículo', () => {
    expect(
      resolveInboundText({
        joinedText: 'quiero info',
        createdAtUnix: '1000',
        ctwa: {
          matched: true,
          adHeadline: 'Vitara',
          capturedAt: new Date(1000 * 1000).toISOString(),
        },
      }).message,
    ).toBe('quiero info {Vitara}');
  });
});
