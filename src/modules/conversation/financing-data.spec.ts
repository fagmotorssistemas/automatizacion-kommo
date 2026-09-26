import {
  appendApplyAsk,
  appendFinancingDataAsk,
  appendFinancingDecline,
  FINANCING_APPLY_ASK,
  FINANCING_DATA_ASK,
  FINANCING_DECLINE,
  gaveFinancingInputs,
  historyAskedFinancingData,
  historyHasShownCuota,
  replyAsksIfApplies,
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

  it('entrada o plazo dichos no son solo elegir el camino', () => {
    expect(
      gaveFinancingInputs(
        'Quiero financiamiento con el del banco',
        'SOLICITUD ACTUAL:\nCliente quiere financiamiento a través de banco.',
      ),
    ).toBe(false);
    expect(gaveFinancingInputs('2 mil de entrada a 6 años')).toBe(true);
    expect(gaveFinancingInputs('Para 5 años')).toBe(true);
  });

  it('detecta cuota con $ en el hilo', () => {
    expect(replyShowsCuota(cuotaMsg)).toBe(true);
    expect(replyShowsCuota('¿Hay financiamiento?')).toBe(false);
    expect(
      historyHasShownCuota([{ role: 'assistant', content: cuotaMsg }]),
    ).toBe(true);
    expect(
      replyShowsCuota(
        'El precio contado es $45800. $2500 y un financiamiento a 6 años, es $1176.39 mensual.',
      ),
    ).toBe(true);
  });

  it('la pregunta de financiamiento también cuenta como ver si aplica', () => {
    expect(
      replyAsksIfApplies(
        '¿Desea que le ayudemos con este financiamiento?',
      ),
    ).toBe(true);
    expect(
      replyAsksIfApplies(
        '¿Desea que le ayudemos a ver si aplica para este crédito?',
      ),
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
