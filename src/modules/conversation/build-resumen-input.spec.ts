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

  it('pasa el tope de contado ya guardado al analizador', () => {
    expect(
      buildResumenInput({
        history: [],
        customerText: 'la última',
        cashBudget: 23000,
      }),
    ).toMatch(/TOPE DE CONTADO YA GUARDADO: 23000/);
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
