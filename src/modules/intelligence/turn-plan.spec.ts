import { buildLexicon } from '../conversation/fuzzy-vehicle-name';
import type { InterestedCarSnapshot } from '../persistence/lead.types';
import {
  buildTurnPlan,
  planCoincideConCaminoViejo,
  turnPlanLog,
  type TurnPlanInput,
} from './turn-plan';

const lexicon = buildLexicon([
  { brand: 'mitsubishi', model: 'montero sport 2.5' },
  { brand: 'chevrolet', model: 'optra advance 1.8l' },
  { brand: 'chevrolet', model: 'aveo ls ac 1.6' },
  { brand: 'kia', model: 'sportage r gti' },
  { brand: 'hyundai', model: 'tucson gl' },
  { brand: 'nissan', model: 'sentra exclusive' },
]);

const montero: InterestedCarSnapshot = {
  inventoryId: 'montero-2022',
  brand: 'mitsubishi',
  model: 'montero sport 2.5',
  year: 2022,
  price: 28900,
  typeBody: 'jeep',
  color: 'blanco',
};

/** Arma un resumen con los flags que importan; el resto queda en «no». */
function resumen(
  solicitud: string,
  flags: Record<string, string> = {},
  vehiculo = 'Mitsubishi Montero Sport 2022',
): string {
  const base: Record<string, string> = {
    'Pide precio': 'no',
    'Pide crédito': 'no',
    'Pide otro color': 'no',
    'Pide otras': 'no',
    'Pide ficha': 'no',
    'Falta vehículo': 'no',
    'Tipo de patio': 'suv',
    'Pide horario': 'no',
    'Pide ubicación': 'no',
    'Tiene duda': 'no',
    'Es despedida': 'no',
    ...flags,
  };
  return [
    `Vehículo: ${vehiculo}`,
    'Contexto: El asesor envió fotos y preguntó si quiere otra opción.',
    '',
    'SOLICITUD ACTUAL:',
    solicitud,
    ...Object.entries(base).map(([key, value]) => `${key}: ${value}`),
  ].join('\n');
}

function plan(overrides: Partial<TurnPlanInput> & { resumen: string }) {
  return buildTurnPlan({
    lexicon,
    unidad: montero,
    ultimoBotListo: false,
    ...overrides,
  });
}

describe('buildTurnPlan', () => {
  it('A70562: visita la otra semana sigue en el Montero, sin marca ni catálogo', () => {
    const result = plan({
      resumen: resumen('Cliente quiere visitar la próxima semana esa unidad.'),
    });
    expect(result.accion).toBe('SEGUIR_UNIDAD');
    expect(result.fuente).toBe('resumen');
    expect(result.seguir).toEqual(['seguimiento']);
    expect(result.vehiculo).toBe('Mitsubishi Montero Sport 2022');
    expect(result.otras).toBeNull();
  });

  it('pide precio: sigue en la unidad y el tema es precio', () => {
    const result = plan({
      resumen: resumen('Cliente quiere el precio.', { 'Pide precio': 'sí' }),
    });
    expect(result.accion).toBe('SEGUIR_UNIDAD');
    expect(result.seguir).toEqual(['precio']);
  });

  it('pide ficha: sigue en la unidad y el tema es ficha', () => {
    const result = plan({
      resumen: resumen('Cliente quiere la ficha de ESA unidad.', {
        'Pide ficha': 'sí',
      }),
    });
    expect(result.accion).toBe('SEGUIR_UNIDAD');
    expect(result.seguir).toEqual(['ficha']);
  });

  it('precio + ubicación: sigue en la unidad con los dos temas', () => {
    const result = plan({
      resumen: resumen('Cliente quiere el precio y dónde verla.', {
        'Pide precio': 'sí',
        'Pide ubicación': 'sí',
      }),
    });
    expect(result.accion).toBe('SEGUIR_UNIDAD');
    expect(result.seguir).toEqual(['precio', 'ubicacion']);
  });

  it('gracias tras «le busco otra opción» con Pide otras: no es cortesía, no aceptar otras', () => {
    const result = plan({
      resumen: resumen('Cliente agradece.', { 'Es cortesía': 'sí' }),
    });
    expect(result.accion).toBe('SEGUIR_UNIDAD');
    expect(result.seguir).toEqual(['cortesia']);
  });

  it('pide otras: la marca y el modelo salen del resumen', () => {
    const result = plan({
      resumen: resumen(
        'Cliente quiere una Hyundai Tucson.',
        { 'Pide otras': 'sí' },
        'No aplica',
      ),
    });
    expect(result.accion).toBe('OTRAS');
    expect(result.otras?.marca).toBe('hyundai');
    expect(result.otras?.modelo?.family).toBe('tucson');
  });

  it('pide otras + caja y tope: los toma del resumen', () => {
    const result = plan({
      resumen: resumen(
        'Cliente quiere un carro manual hasta 15000.',
        {
          'Pide otras': 'sí',
          'Caja de compra': 'manual',
          'Tope de contado': '15000',
        },
        'No aplica',
      ),
    });
    expect(result.accion).toBe('OTRAS');
    expect(result.otras?.caja).toBe('manual');
    expect(result.otras?.topeContado).toBe(15000);
  });

  it('Pide otras: no pero el resumen nombra otra marca: es cambio de carro', () => {
    const result = plan({
      resumen: resumen('Cliente quiere el precio de un Nissan.', {
        'Pide precio': 'sí',
      }),
    });
    expect(result.accion).toBe('OTRAS');
    expect(result.otras?.marca).toBe('nissan');
  });

  it('otro color de la misma unidad: busca otras', () => {
    const result = plan({
      resumen: resumen('Cliente quiere otro color.', {
        'Pide otro color': 'sí',
      }),
    });
    expect(result.accion).toBe('OTRAS');
    expect(result.otras?.otroColor).toBe(true);
  });

  it('tope menor + pide otras: busca otras', () => {
    const result = plan({
      resumen: resumen('Cliente tiene 12000.', {
        'Pide otras': 'sí',
        'Tope de contado': '12000',
      }),
    });
    expect(result.accion).toBe('OTRAS');
  });

  it('tope viejo + negociar: sigue en la unidad, no reabre presupuesto', () => {
    const result = plan({
      resumen: resumen('Cliente pregunta si el precio es negociable.', {
        'Pide negociar': 'sí',
        'Tope de contado': '10000',
      }),
    });
    expect(result.accion).toBe('SEGUIR_UNIDAD');
    expect(result.seguir).toEqual(['negociar']);
  });

  it('tope viejo + precio de esa unidad: sigue, no reabre presupuesto', () => {
    const result = plan({
      resumen: resumen('Cliente quiere el precio de ESA unidad.', {
        'Pide precio': 'sí',
        'Tope de contado': '10000',
      }),
    });
    expect(result.accion).toBe('SEGUIR_UNIDAD');
    expect(result.seguir).toEqual(['precio']);
  });

  it('tope viejo + ubicación: sigue, no reabre presupuesto', () => {
    const result = plan({
      resumen: resumen('Cliente pide la ubicación.', {
        'Pide ubicación': 'sí',
        'Tope de contado': '10000',
      }),
    });
    expect(result.accion).toBe('SEGUIR_UNIDAD');
    expect(result.seguir).toEqual(['ubicacion']);
  });

  it('el bot acaba de listar y no pide otras: elige de la lista', () => {
    const result = plan({
      ultimoBotListo: true,
      resumen: resumen('Cliente elige la 2018.'),
    });
    expect(result.accion).toBe('ELEGIR_DE_LISTA');
  });

  it('el bot acaba de listar y pide otras: busca otras', () => {
    const result = plan({
      ultimoBotListo: true,
      resumen: resumen('Cliente quiere otras.', { 'Pide otras': 'sí' }),
    });
    expect(result.accion).toBe('OTRAS');
  });

  it('despedida gana sobre todo lo demás', () => {
    const result = plan({
      resumen: resumen('Cliente se despide.', {
        'Es despedida': 'sí',
        'Pide precio': 'sí',
        'Pide horario': 'sí',
      }),
    });
    expect(result.accion).toBe('CIERRE');
  });

  it('despedida con duda pendiente no es cierre', () => {
    const result = plan({
      resumen: resumen('Cliente agradece pero tiene una duda.', {
        'Es despedida': 'sí',
        'Tiene duda': 'sí',
      }),
    });
    expect(result.accion).toBe('SEGUIR_UNIDAD');
    expect(result.seguir).toEqual(['duda']);
  });

  it('pide horario: HORARIO', () => {
    const result = plan({
      resumen: resumen('Cliente pregunta si atienden.', { 'Pide horario': 'sí' }),
    });
    expect(result.accion).toBe('HORARIO');
  });

  it('pide plazas: ASIENTOS', () => {
    const result = plan({
      resumen: resumen('Cliente quiere 7 asientos.', { Asientos: '7' }),
    });
    expect(result.accion).toBe('ASIENTOS');
    expect(result.asientos).toBe(7);
  });

  it('vende su carro: VENTA_PROPIA (lo dice intents)', () => {
    const result = plan({
      ventaPropia: true,
      resumen: resumen('Cliente quiere vender su carro.'),
    });
    expect(result.accion).toBe('VENTA_PROPIA');
  });

  it('sin unidad y Falta vehículo: sí: PEDIR_CARRO', () => {
    const result = plan({
      unidad: null,
      resumen: resumen(
        'Cliente pide el precio sin decir cuál.',
        { 'Falta vehículo': 'sí', 'Pide precio': 'sí' },
        'No aplica',
      ),
    });
    expect(result.accion).toBe('PEDIR_CARRO');
  });

  it('sin unidad pero el resumen nombra un vehículo: busca ese', () => {
    const result = plan({
      unidad: null,
      resumen: resumen('Cliente quiere el Optra.', {}, 'Chevrolet Optra 2012'),
    });
    expect(result.accion).toBe('OTRAS');
    expect(result.otras?.marca).toBe('chevrolet');
  });

  it('el resumen no trae «Pide otras»: no decide, usa el respaldo', () => {
    const result = plan({
      resumen: 'SOLICITUD ACTUAL:\nCliente quiere el precio.',
    });
    expect(result.accion).toBe('RESPALDO');
    expect(result.fuente).toBe('respaldo');
  });

  it('sin unidad, sin vehículo y sin flag de falta: ambiguo, respaldo', () => {
    const result = plan({
      unidad: null,
      resumen: resumen('Cliente saluda.', {}, 'No aplica'),
    });
    expect(result.accion).toBe('RESPALDO');
  });

  it('el Contexto viejo no cuenta: «otra opción» ahí no cambia de carro', () => {
    // El Contexto de resumen() dice «si quiere otra opción» (fuzzy: Optra).
    const result = plan({
      resumen: resumen('Cliente quiere visitar la próxima semana esa unidad.'),
    });
    expect(result.accion).toBe('SEGUIR_UNIDAD');
    expect(result.razon).toMatch(/sigue en la unidad/i);
  });
});

describe('comparación plan vs camino viejo', () => {
  it('SEGUIR_UNIDAD solo coincide con SEGUIR_UNIDAD', () => {
    expect(planCoincideConCaminoViejo('SEGUIR_UNIDAD', 'SEGUIR_UNIDAD')).toBe(true);
    expect(planCoincideConCaminoViejo('SEGUIR_UNIDAD', 'REVIEW_BRAND')).toBe(false);
  });

  it('OTRAS, ELEGIR_DE_LISTA y PEDIR_CARRO pasan por reviewBrand en el camino viejo', () => {
    expect(planCoincideConCaminoViejo('OTRAS', 'REVIEW_BRAND')).toBe(true);
    expect(planCoincideConCaminoViejo('ELEGIR_DE_LISTA', 'REVIEW_BRAND')).toBe(true);
    expect(planCoincideConCaminoViejo('PEDIR_CARRO', 'PEDIR_CARRO')).toBe(true);
    expect(planCoincideConCaminoViejo('PEDIR_CARRO', 'REVIEW_BRAND')).toBe(true);
    expect(planCoincideConCaminoViejo('OTRAS', 'SEGUIR_UNIDAD')).toBe(false);
  });

  it('CIERRE, HORARIO, ASIENTOS y VENTA_PROPIA deben ser la misma rama', () => {
    for (const rama of ['CIERRE', 'HORARIO', 'ASIENTOS', 'VENTA_PROPIA'] as const) {
      expect(planCoincideConCaminoViejo(rama, rama)).toBe(true);
      expect(planCoincideConCaminoViejo(rama, 'REVIEW_BRAND')).toBe(false);
    }
  });

  it('RESPALDO no decide: coincide es null', () => {
    expect(planCoincideConCaminoViejo('RESPALDO', 'SEGUIR_UNIDAD')).toBeNull();
  });

  it('el log lleva acción, razón, camino viejo y si coinciden', () => {
    const result = plan({
      resumen: resumen('Cliente quiere visitar la próxima semana esa unidad.'),
    });
    expect(turnPlanLog(result, 'REVIEW_BRAND')).toEqual({
      accion: 'SEGUIR_UNIDAD',
      fuente: 'resumen',
      razon: 'Pide otras: no y sigue en la unidad',
      caminoViejo: 'REVIEW_BRAND',
      coincide: false,
    });
  });
});
