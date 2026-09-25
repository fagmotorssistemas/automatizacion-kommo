import {
  isHardFarewell,
  isPauseLater,
  isPoliteThanks,
  isSoftNo,
  lastAskIsFinancingOrVisit,
  NO_REPETIR_CTA,
  PAUSA_SIGUE,
  salesFollowHint,
  SEGUIR_VENTA,
} from './polite-thanks';

const SELTOS_CTA =
  '¿Le gustaría que le brinde información sobre opciones de financiamiento para este Kia Seltos 2020 o prefiere coordinar una visita para conocerlo en persona?';

describe('gracias no es despedida', () => {
  it('un gracias después de la atención sigue siendo la venta', () => {
    expect(
      isPoliteThanks('Muchas gracias por su atención y comunicación.'),
    ).toBe(true);
  });

  it('un rechazo duro sí cierra', () => {
    expect(isPoliteThanks('no gracias, ya no me interesa')).toBe(false);
    expect(isHardFarewell('no gracias, ya no me interesa')).toBe(true);
    expect(isPoliteThanks('ya compré en otro lado')).toBe(false);
  });
});

describe('no a la última oferta no se repite', () => {
  it('detecta la pregunta de financiamiento o visita', () => {
    expect(lastAskIsFinancingOrVisit(SELTOS_CTA)).toBe(true);
    expect(
      lastAskIsFinancingOrVisit(
        'Tenemos una Nissan X-Trail 2016 en $16890.',
      ),
    ).toBe(false);
  });

  it('no gracias solo es un no suave, no despedida', () => {
    expect(isSoftNo('No gracias')).toBe(true);
    expect(isHardFarewell('No gracias')).toBe(false);
    expect(isPoliteThanks('No gracias')).toBe(false);
  });

  it('después de financiamiento o visita no vuelve a preguntar', () => {
    const hint = salesFollowHint({
      customerText: 'No gracias',
      lastAssistant: SELTOS_CTA,
      hasDoubt: false,
      isFarewell: false,
      isCourtesy: true,
    });
    expect(hint).toBe(NO_REPETIR_CTA);
    expect(hint).not.toContain('haz UNA pregunta: financiamiento o visita');
  });

  it('un gracias de verdad sí pide financiamiento o visita', () => {
    expect(
      salesFollowHint({
        customerText: 'Muchas gracias por su atención y comunicación.',
        lastAssistant: 'Tenemos una Nissan X-Trail 2016 en $16890.',
        hasDoubt: false,
        isFarewell: false,
        isCourtesy: false,
      }),
    ).toBe(SEGUIR_VENTA);
  });

  it('aún no es pausa, no cierre ni la misma pregunta', () => {
    expect(isPauseLater('aún no, seguimos en contacto')).toBe(true);
    expect(
      salesFollowHint({
        customerText: 'aún no, seguimos en contacto',
        lastAssistant: SELTOS_CTA,
        hasDoubt: false,
        isFarewell: false,
        isCourtesy: false,
      }),
    ).toBe(PAUSA_SIGUE);
  });

  it('despedida dura no inyecta seguimiento', () => {
    expect(
      salesFollowHint({
        customerText: 'ya no me interesa',
        lastAssistant: SELTOS_CTA,
        hasDoubt: false,
        isFarewell: true,
        isCourtesy: false,
      }),
    ).toBe('');
  });
});
