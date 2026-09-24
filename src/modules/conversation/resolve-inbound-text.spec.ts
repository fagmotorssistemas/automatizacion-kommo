import { resolveInboundText } from './resolve-inbound-text';

describe('resolveInboundText', () => {
  const opener = '¡Hola! Me gustaría conseguir más información sobre esto.';
  const click = {
    matched: true,
    adHeadline: 'F150 2022',
    capturedAt: new Date(1000 * 1000).toISOString(),
  };

  it('sin match deja la cadena del debounce', () => {
    expect(
      resolveInboundText({
        joinedText: opener,
        createdAtUnix: '1000',
        ctwa: { matched: false, adHeadline: 'Hilux', capturedAt: null },
      }),
    ).toEqual({
      message: opener,
      source: 'buffer',
      vehicle: null,
      withinWindow: false,
    });
  });

  it('match fuera de 60 s no anota el vehículo', () => {
    expect(
      resolveInboundText({
        joinedText: opener,
        createdAtUnix: '1000',
        ctwa: {
          matched: true,
          adHeadline: 'Hilux 2022',
          capturedAt: new Date(1000 * 1000 + 120_000).toISOString(),
        },
      }).source,
    ).toBe('buffer');
  });

  it('el primer clic de Facebook anota el título del anuncio', () => {
    expect(
      resolveInboundText({
        joinedText: opener,
        createdAtUnix: '1000',
        alreadyInConversation: false,
        ctwa: click,
      }),
    ).toEqual({
      message:
        '¡Hola! Me gustaría conseguir más información sobre esto {F150 2022}.',
      source: 'ad',
      vehicle: 'F150 2022',
      withinWindow: true,
    });
  });

  it('si el primer mensaje ya nombra el modelo, no se pega el título', () => {
    const text = 'Hola. Me interesa la Chevrolet Dmax 2022';
    expect(
      resolveInboundText({
        joinedText: text,
        createdAtUnix: '1000',
        ctwa: click,
      }),
    ).toEqual({
      message: text,
      source: 'buffer',
      vehicle: null,
      withinWindow: true,
    });
  });

  it('una pregunta de dirección no hereda el anuncio', () => {
    const text = 'Yo soy de gualaquiza y ustedes de dond son';
    expect(
      resolveInboundText({
        joinedText: text,
        createdAtUnix: '1000',
        ctwa: click,
      }).message,
    ).toBe(text);
  });

  it('después del primer turno no se vuelve a pegar el título', () => {
    expect(
      resolveInboundText({
        joinedText: opener,
        createdAtUnix: '1000',
        alreadyInConversation: true,
        ctwa: click,
      }).message,
    ).toBe(opener);
  });
});
