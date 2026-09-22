import { parseConversationReading } from './parse-analysis';

describe('parseConversationReading', () => {
  it('acepta el schema', () => {
    expect(
      parseConversationReading({
        objecion_principal: 'equipamiento',
        objecion_texto: 'Quiere manual',
        objecion_evidencia: 'Solo tienen auitomatico ?',
        agendo_visita: false,
        resumen: 'Pidió transmisión manual.\nNo siguió.',
        presupuesto_declarado: '',
      }),
    ).toMatchObject({
      objecionPrincipal: 'equipamiento',
      agendoVisita: false,
      presupuestoDeclarado: null,
    });
  });

  it('rechaza un enum desconocido', () => {
    expect(
      parseConversationReading({
        objecion_principal: 'plazo',
        objecion_texto: 'x',
        objecion_evidencia: 'x',
        agendo_visita: false,
        resumen: 'x',
      }),
    ).toBeNull();
  });
});
