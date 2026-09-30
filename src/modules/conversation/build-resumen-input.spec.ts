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

  it('pasa el resumen del turno anterior al analizador', () => {
    expect(
      buildResumenInput({
        history: [{ role: 'user', content: 'Quiero un Mazda. 3' }],
        customerText: 'No amigo un Mazda 3 busco',
        previousResumen:
          'Vehículo: Mazda 3\nSOLICITUD: Cliente quiere un Mazda 3.',
      }),
    ).toMatch(
      /RESUMEN DEL TURNO ANTERIOR:\nVehículo: Mazda 3\nSOLICITUD: Cliente quiere un Mazda 3\./,
    );
  });

  it('el turno anterior al LLM no lleva líneas de banderas', () => {
    expect(
      buildResumenInput({
        history: [],
        customerText: '¿precio?',
        previousResumen:
          'Vehículo: Toyota 4 runner\nContexto: fotos\nSOLICITUD ACTUAL:\nCliente quiere una camioneta.\nTipo de patio: camioneta\nCabina: doble\nPide precio: no',
      }),
    ).toBe(`RESUMEN DEL TURNO ANTERIOR:
Vehículo: Toyota 4 runner
Contexto: fotos
SOLICITUD: Cliente quiere una camioneta.

MENSAJE ACTUAL:
¿precio?`);
    expect(
      buildResumenInput({
        history: [],
        customerText: 'ok',
        previousResumen:
          'Vehículo: Toyota 4 runner\nSOLICITUD ACTUAL:\nCliente quiere una camioneta.\nTipo de patio: camioneta',
      }),
    ).not.toMatch(/Tipo de patio/i);
  });

  it('pasa el tope de contado ya guardado al analizador', () => {
    expect(
      buildResumenInput({
        history: [],
        customerText: 'la última',
        cashBudget: 23000,
      }),
    ).toMatch(
      /TOPE DE CONTADO YA GUARDADO \(contexto de turnos previos; NO es el pedido de este turno salvo que el cliente lo vuelva a pedir ahora\): 23000/,
    );
  });

  it('pasa el checklist de toma ya guardado al analizador', () => {
    expect(
      buildResumenInput({
        history: [],
        customerText: 'no tengo fotos',
        tomaChecklist: {
          have: { marca: 'Jetour', anio: '2024' },
          pending: [],
        },
      }),
    ).toMatch(/CHECKLIST TOMA YA GUARDADO:[\s\S]*marca=Jetour/);
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
