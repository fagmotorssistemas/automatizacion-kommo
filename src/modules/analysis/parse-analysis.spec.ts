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
        seguimiento: 'activo',
      }),
    ).toMatchObject({
      objecionPrincipal: 'equipamiento',
      agendoVisita: false,
      presupuestoDeclarado: null,
      seguimiento: 'activo',
    });
  });

  it('acepta objeción nula si no objetó', () => {
    expect(
      parseConversationReading({
        objecion_principal: null,
        objecion_texto: '',
        objecion_evidencia: '',
        agendo_visita: true,
        resumen: 'Agendó visita mañana.\nSigue vivo.',
        presupuesto_declarado: '',
        seguimiento: 'activo',
      }),
    ).toMatchObject({
      objecionPrincipal: null,
      agendoVisita: true,
    });
  });

  it('separa presupuesto de entrada y no toma la retoma como pago', () => {
    expect(
      parseConversationReading({
        objecion_principal: null,
        objecion_texto: '',
        objecion_evidencia: '',
        agendo_visita: false,
        resumen: 'Tiene 12 mil para el carro.\nDa 4 mil de entrada.',
        presupuesto_declarado: 'tiene 12 mil, da 4 mil de entrada',
        presupuesto_monto: 12000,
        entrada_disponible: 4000,
        forma_pago: 'contado',
        seguimiento: 'activo',
      }),
    ).toMatchObject({
      presupuestoDeclarado: 'tiene 12 mil, da 4 mil de entrada',
      presupuestoMonto: 12000,
      entradaDisponible: 4000,
      formaPago: 'contado',
    });
    expect(
      parseConversationReading({
        objecion_principal: null,
        objecion_texto: '',
        objecion_evidencia: '',
        agendo_visita: false,
        resumen: 'Entrega su Spark.',
        presupuesto_declarado: '',
        presupuesto_monto: null,
        entrada_disponible: null,
        forma_pago: 'retoma',
        seguimiento: 'aplazado',
      }),
    ).toMatchObject({
      presupuestoMonto: null,
      entradaDisponible: null,
      formaPago: null,
      seguimiento: 'aplazado',
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
        seguimiento: 'activo',
      }),
    ).toBeNull();
  });
});
