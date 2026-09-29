import {
  appendApplyAsk,
  appendFinancingDataAsk,
  appendFinancingDecline,
  FINANCING_APPLY_ASK,
  FINANCING_DATA_ASK,
  FINANCING_DECLINE,
  financingInputsFromThread,
  gaveFinancingInputs,
  historyAskedFinancingData,
  historyHasShownCuota,
  mergeFinancingQuote,
  parseDownPayment,
  parseFinancingYears,
  replyAsksIfApplies,
  replyShowsCuota,
  shouldAskFinancingData,
  shouldAskIfApplies,
  shouldEncourageAfterDecline,
  stripGestionarOffer,
  stripPrematureApplyAsk,
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
    expect(
      replyShowsCuota(
        'Con una entrada de $8000 para el Hyundai Santa Fe 2018, ¿a cuántos años desea financiar? Esto me permite calcular la cuota aproximada de financiamiento. ¿Desea que le ayudemos a ver si aplica al crédito?',
      ),
    ).toBe(false);
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

  it('«ver si aplica» sin la palabra crédito no se vuelve a preguntar (A76351)', () => {
    const reply = `${cuotaMsg} ¿Desea que un asesor le ayude a ver si aplica?`;
    expect(replyAsksIfApplies(reply)).toBe(true);
    expect(
      shouldAskIfApplies({
        showedCuotaNow: true,
        hasCedula: false,
        history: [],
        reply,
      }),
    ).toBe(false);
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
      shouldAskFinancingData({
        history: [{ role: 'assistant', content: FINANCING_APPLY_ASK }],
        aceptaCredito: true,
        hasCedula: false,
      }),
    ).toBe(false);
    expect(
      shouldAskFinancingData({
        history: [{ role: 'assistant', content: cuotaMsg }],
        aceptaCredito: true,
        hasCedula: false,
        showedCuotaNow: true,
      }),
    ).toBe(false);
    expect(
      shouldAskIfApplies({
        showedCuotaNow: true,
        hasCedula: false,
        history: [],
      }),
    ).toBe(true);
    expect(
      shouldAskIfApplies({
        showedCuotaNow: true,
        hasCedula: false,
        history: [
          {
            role: 'assistant',
            content:
              'Con una entrada de $8000, ¿a cuántos años desea financiar? ¿Desea que le ayudemos a ver si aplica al crédito?',
          },
        ],
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

  it('A72955: lee entrada y 48 meses del hilo y no deja el mensaje cortado', () => {
    expect(parseDownPayment('Yo tengo para dar una entrada de 8000')).toBe(
      8000,
    );
    expect(parseDownPayment('Con $1,000 de entrada')).toBe(1000);
    expect(parseFinancingYears('sacar en 48 meses a como salen las letras')).toBe(
      4,
    );
    expect(
      financingInputsFromThread(
        'Claro ayudema hay a sacar en 48 meses a como salen las letras',
        'Pide crédito: sí\nAcepta crédito: sí',
        [
          { role: 'user', content: 'Yo tengo para dar una entrada de 8000' },
          {
            role: 'assistant',
            content:
              'Con una entrada de $8000, ¿a cuántos años desea financiar? ¿Desea que le ayudemos a ver si aplica al crédito?',
          },
        ],
      ),
    ).toEqual({ entrada: 8000, anos: 4 });
    const stub =
      'y financiamiento a 48 meses para el Hyundai Santa Fe 2018. Este valor es referencial, con tasa promedio del mercado; el banco o cooperativa definirán el monto final y condiciones. ¿Desea que le ayudemos a ver si aplica al crédito? Para seguir con el crédito, ¿me ayuda con estos datos: su cédula, su nombre completo y de dónde es?';
    expect(stripPrematureApplyAsk(stub)).not.toMatch(/ver si aplica/i);
    const merged = mergeFinancingQuote(
      stub,
      'Con una entrada de $8,000 y financiamiento a 48 meses, la cuota aproximada es $522.39. Este valor es referencial, con tasa promedio del mercado; el banco o cooperativa definirán el monto final y condiciones.',
    );
    expect(merged).not.toMatch(/^y financiamiento/i);
    expect(merged).toMatch(/cuota aproximada es \$522\.39/i);
    expect(merged).not.toMatch(/cédula/i);
  });
});
