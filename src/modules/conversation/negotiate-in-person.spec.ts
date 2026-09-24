import {
  appendNegotiateInPerson,
  NEGOTIATE_IN_PERSON,
  shouldSayNegotiateInPerson,
} from './negotiate-in-person';

describe('negociar en persona', () => {
  it('pega que no hay descuento por chat y debe venir', () => {
    expect(
      shouldSayNegotiateInPerson({ pideNegociar: true, history: [] }),
    ).toBe(true);
    expect(appendNegotiateInPerson('El Tracker está en buen estado.')).toContain(
      NEGOTIATE_IN_PERSON,
    );
    expect(
      shouldSayNegotiateInPerson({
        pideNegociar: true,
        history: [
          { role: 'assistant', content: NEGOTIATE_IN_PERSON },
        ],
      }),
    ).toBe(false);
    expect(
      shouldSayNegotiateInPerson({
        pideNegociar: true,
        history: [],
        reply:
          'Este Fiat está en excelente estado y no puedo ofrecer descuento por este medio. ¿Le interesa financiamiento o una visita?',
      }),
    ).toBe(false);
  });
});
