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

  it('si el modelo ya dijo que no hay descuentos, no pega la frase otra vez', () => {
    const reply =
      'Este por el excelente estado del Volkswagen Golf Comfortline 2.0 4p 2005, con 276968 km, documentos en regla y entrega inmediata. No ofrecemos descuentos por este medio, pero puede venir a la concesionaria para coordinarlo directamente con un asesor. Nuestra dirección es Av. España 6-73 y Sevilla, Cuenca.';
    expect(
      shouldSayNegotiateInPerson({
        pideNegociar: true,
        history: [],
        reply,
      }),
    ).toBe(false);
    expect(appendNegotiateInPerson(reply)).toBe(reply);
    expect(appendNegotiateInPerson(reply)).not.toMatch(
      /no podemos ofrecer descuento/i,
    );
  });
});
