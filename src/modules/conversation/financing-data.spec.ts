import {
  appendApplyAsk,
  appendFinancingDataAsk,
  appendFinancingDecline,
  FINANCING_APPLY_ASK,
  FINANCING_DATA_ASK,
  FINANCING_DECLINE,
  historyAskedFinancingData,
  historyHasShownCuota,
  replyShowsCuota,
  shouldAskFinancingData,
  shouldAskIfApplies,
  shouldEncourageAfterDecline,
  stripGestionarOffer,
  stripPrematureIdentityAsk,
} from './financing-data';

describe('datos de financiamiento', () => {
  const cuotaMsg =
    'Con $2000 de entrada la cuota estimada mensual sería alrededor de $590.21.';

  it('detecta cuota con $ en el hilo', () => {
    expect(replyShowsCuota(cuotaMsg)).toBe(true);
    expect(replyShowsCuota('¿Hay financiamiento?')).toBe(false);
    expect(
      historyHasShownCuota([{ role: 'assistant', content: cuotaMsg }]),
    ).toBe(true);
  });

  it('en la cuota quita gestionar y cédula, y pregunta si aplica', () => {
    const raw = `${cuotaMsg} ¿Desea que le ayudemos para gestionar esto? ¿Me pasa su cédula?`;
    const text = appendApplyAsk(
      stripPrematureIdentityAsk(stripGestionarOffer(raw)),
    );
    expect(text).toMatch(/590/);
    expect(text).toContain(FINANCING_APPLY_ASK);
    expect(text).not.toMatch(/gestionar/i);
    expect(text).not.toMatch(/cédula/i);
  });

  it('pide los 3 datos solo si ya hubo cuota y ahora acepta', () => {
    expect(
      shouldAskFinancingData({
        history: [{ role: 'assistant', content: cuotaMsg }],
        aceptaCredito: true,
        hasCedula: false,
      }),
    ).toBe(true);
    expect(
      shouldAskFinancingData({
        history: [],
        aceptaCredito: true,
        hasCedula: false,
      }),
    ).toBe(false);
    expect(
      shouldAskIfApplies({
        showedCuotaNow: true,
        hasCedula: false,
        history: [],
      }),
    ).toBe(true);
  });

  it('si dice que no, motiva a seguir con el carro', () => {
    expect(
      shouldEncourageAfterDecline({
        history: [
          { role: 'assistant', content: `${cuotaMsg} ${FINANCING_APPLY_ASK}` },
        ],
        rechazaAplicar: true,
        hasCedula: false,
      }),
    ).toBe(true);
    expect(appendFinancingDecline('Listo.')).toContain(FINANCING_DECLINE);
    expect(appendFinancingDataAsk('Perfecto.')).toContain(FINANCING_DATA_ASK);
    expect(historyAskedFinancingData([{ role: 'assistant', content: FINANCING_DATA_ASK }])).toBe(
      true,
    );
  });
});
