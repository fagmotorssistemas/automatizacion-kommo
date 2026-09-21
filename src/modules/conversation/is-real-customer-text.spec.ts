import {
  isRealCustomerText,
  isSyntheticCustomerText,
  keepCustomerFacingMessages,
} from './is-real-customer-text';

describe('isRealCustomerText', () => {
  it('marca RESUMEN PREVIO como texto sintético del bot', () => {
    const resumen = `RESUMEN PREVIO:
Vehículo: Hilux
Contexto: pidió precio

SOLICITUD ACTUAL:
Cliente quiere financiamiento.`;

    expect(isSyntheticCustomerText(resumen)).toBe(true);
    expect(isRealCustomerText(resumen)).toBe(false);
    expect(isRealCustomerText(`  ${resumen}`)).toBe(false);
  });

  it('deja pasar lo que sí dijo el cliente', () => {
    expect(isRealCustomerText('me interesa una hilux')).toBe(true);
    expect(isRealCustomerText('RESUMEN de lo que vimos ayer')).toBe(true);
    expect(isRealCustomerText('')).toBe(false);
  });

  it('saca el human duplicado y deja el resto del hilo', () => {
    expect(
      keepCustomerFacingMessages([
        { role: 'user', content: 'hola' },
        {
          type: 'human',
          content: 'RESUMEN PREVIO:\nVehículo: Hilux',
        },
        { role: 'assistant', content: 'Tenemos una Hilux.' },
      ]),
    ).toEqual([
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: 'Tenemos una Hilux.' },
    ]);
  });
});
