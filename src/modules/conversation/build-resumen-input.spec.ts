import { buildResumenInput } from './build-resumen-input';

describe('buildResumenInput', () => {
  it('primera interacción solo manda el mensaje actual', () => {
    expect(
      buildResumenInput({
        history: [],
        customerText: 'me interesa una hilux',
      }),
    ).toBe('MENSAJE ACTUAL:\nme interesa una hilux');
  });

  it('mete el hilo cliente-bot como contexto del RESUMEN PREVIO', () => {
    expect(
      buildResumenInput({
        history: [
          { role: 'user', content: 'hola, hay ranger?' },
          { role: 'assistant', content: 'Sí, tenemos una Ranger 2024.' },
          {
            role: 'assistant',
            content: 'CONTEXTO ASESOR (bot estuvo apagado):\nLe llamó Vanessa',
          },
        ],
        customerText: 'cuánto cuesta',
        handoffBrief: 'Vanessa prometió llamarle',
      }),
    ).toBe(`RESUMEN DEL TRAMO CON ASESOR:
Vanessa prometió llamarle

HISTORIAL:
Cliente: hola, hay ranger?
Asesor: Sí, tenemos una Ranger 2024.

MENSAJE ACTUAL:
cuánto cuesta`);
  });
});
