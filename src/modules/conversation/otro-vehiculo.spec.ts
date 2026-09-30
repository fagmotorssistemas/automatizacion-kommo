import { leftShownCar } from './interested-car';
import { TEST_LEXICON } from './test-lexicon';
import { buildLexicon } from './fuzzy-vehicle-name';
import {
  decideStayOnShown,
  evidenciaReal,
  fila1Nueva,
  mismaUnidadPorFila,
  consultarOtroEsLaMostrada,
  debeConsultarRpcOtro,
} from './otro-vehiculo';
import { mergeResumenForNext, solicitudSinBanderas } from '../intelligence/parse-resumen';
import { analyzeTurn } from '../intelligence/analyze-turn';
import { InterestedCarSnapshot } from '../persistence/lead.types';

const sportage: InterestedCarSnapshot = {
  inventoryId: 'plata-1',
  brand: 'kia',
  model: 'sportage r gti 2019 ta',
  year: 2019,
  price: 22900,
  color: 'plateado',
  typeBody: 'jeep',
  transmission: 'automática',
};

const sportageLx: InterestedCarSnapshot = {
  ...sportage,
  model: 'sportage lx',
};

const dmax: InterestedCarSnapshot = {
  inventoryId: 'dmax-2022',
  brand: 'chevrolet',
  model: 'd-max',
  year: 2022,
  price: 24500,
  color: 'rojo',
  transmission: 'automática',
};

const c300: InterestedCarSnapshot = {
  inventoryId: 'c300-1',
  brand: 'mercedes-benz',
  model: 'c 300 amg line ac 2.0 4p 4x2 automatico',
  year: 2024,
  price: 61990,
  color: 'blanco',
  typeBody: 'sedan',
  transmission: 'automática',
};

const peugeot3008n: InterestedCarSnapshot = {
  inventoryId: 'p3008n',
  brand: 'peugeot',
  model: '3008n',
  year: 2022,
  price: 28900,
};

const mercedesLexicon = buildLexicon([
  { brand: 'mercedes-benz', model: c300.model },
]);

function resumenCon(lineas: string, otro: string): string {
  return `${lineas}\nOtro vehículo: ${otro}`;
}

describe('resumenOtroVehiculo aislado de consumidores actuales', () => {
  const resúmenes: { name: string; resumen: string; text: string; car: InterestedCarSnapshot }[] = [
    {
      name: 'cámara Sportage',
      text: 'tiene cámara de reversa?',
      car: sportage,
      resumen:
        'RESUMEN PREVIO:\nVehículo: Kia Sportage 2019 plateado\nSOLICITUD ACTUAL:\nCliente quiere saber si tiene cámara.\nPide otras: no',
    },
    {
      name: 'C 300 ficha',
      text: 'está en buen estado? tiene cámara?',
      car: c300,
      resumen:
        'SOLICITUD ACTUAL:\nCliente pregunta estado y cámara del C 300.\nPide otras: no',
    },
    {
      name: 'Peugeot crédito',
      text: '2000 de entrada',
      car: peugeot3008n,
      resumen:
        'RESUMEN PREVIO:\nVehículo: Peugeot 3008 2022\nSOLICITUD ACTUAL:\nCliente quiere la entrada y el plazo del Peugeot 3008 2022.\nPide crédito: sí\nPide otras: no\nCaja de compra: automática',
    },
    {
      name: 'ok entendió',
      text: 'ok entendió',
      car: sportage,
      resumen:
        'SOLICITUD ACTUAL:\nCliente confirma que entendió.\nPide otras: no',
    },
    {
      name: 'visita próxima semana',
      text: 'visitar la próxima semana',
      car: sportage,
      resumen:
        'SOLICITUD ACTUAL:\nCliente quiere visitar la próxima semana esta unidad.\nPide otras: no',
    },
  ];

  it.each(resúmenes)(
    'leftShownCar no cambia si agregamos Otro vehículo: Santa Fe ($name)',
    ({ resumen, text, car }) => {
      const conLinea = `${resumen}\nOtro vehículo: Santa Fe`;
      expect(
        leftShownCar({ text, resumen: conLinea, car, lexicon: TEST_LEXICON }),
      ).toBe(leftShownCar({ text, resumen, car, lexicon: TEST_LEXICON }));
    },
  );

  it('solicitudSinBanderas quita la línea Otro vehículo', () => {
    expect(
      solicitudSinBanderas(
        'SOLICITUD ACTUAL:\nCliente quiere visitar esta unidad.\nPide otras: no\nOtro vehículo: Santa Fe',
      ),
    ).toBe('Cliente quiere visitar esta unidad.');
  });

  it('mergeResumenForNext no arrastra Otro vehículo', () => {
    const merged = mergeResumenForNext(
      'RESUMEN PREVIO:\nVehículo: Kia Sportage\nSOLICITUD ACTUAL:\nCliente quiere el precio.\nPide otras: no\nOtro vehículo: Santa Fe',
      null,
    );
    expect(merged).not.toMatch(/Otro vehículo/i);
    expect(merged).not.toMatch(/Santa Fe/i);
  });

  it('analyzeTurn no guarda Santa Fe en solicitudCliente', () => {
    const signals = analyzeTurn({
      leadId: '1',
      mensaje: 'ok',
      resumen:
        'SOLICITUD ACTUAL:\nCliente quiere el precio.\nPide otras: no\nOtro vehículo: Santa Fe',
    });
    expect(signals.solicitudCliente).not.toMatch(/Santa Fe/i);
    expect(signals.solicitudCliente).not.toMatch(/Otro vehículo/i);
  });
});

describe('fila1Nueva', () => {
  it('Otro vehículo: no sigue en visita, ok, cámara y califico', () => {
    for (const text of [
      'visitar la próxima semana',
      'ok entendió',
      'tiene cámara de reversa?',
      'califico?',
    ]) {
      expect(
        fila1Nueva({
          resumen: resumenCon('SOLICITUD ACTUAL:\nCliente sigue.\nPide otras: no', 'no'),
          customerText: text,
          lastAssistantText: '',
          car: sportage,
          otroEsLaMostrada: null,
        }),
      ).toEqual({ suelta: false, motivo: 'sin_otro' });
    }
  });

  it('Aveo sin evidencia en el texto sigue', () => {
    expect(
      fila1Nueva({
        resumen: resumenCon(
          'SOLICITUD ACTUAL:\nCliente quiere visitar esta unidad.\nPide otras: no',
          'Aveo',
        ),
        customerText: 'quiero visitar esta unidad',
        lastAssistantText: '',
        car: sportage,
        otroEsLaMostrada: null,
      }),
    ).toEqual({ suelta: false, motivo: 'sin_evidencia' });
  });

  it('sí + Premiere 2020 del bot suelta la D-Max', () => {
    expect(
      fila1Nueva({
        resumen: resumenCon(
          'SOLICITUD ACTUAL:\nCliente acepta esa unidad.\nPide otras: no',
          'Premiere 2020',
        ),
        customerText: 'sí',
        lastAssistantText: 'Tenemos la Premiere 2020 si le interesa',
        car: dmax,
        otroEsLaMostrada: null,
      }),
    ).toEqual({ suelta: true, motivo: 'otro_anio_version_color' });
  });

  it('2000 de entrada con Otro vehículo: no sigue', () => {
    expect(
      fila1Nueva({
        resumen: resumenCon(
          'SOLICITUD ACTUAL:\nCliente da 2000 de entrada.\nPide crédito: sí\nPide otras: no',
          'no',
        ),
        customerText: '2000 de entrada',
        lastAssistantText: '',
        car: sportage,
        otroEsLaMostrada: null,
      }).suelta,
    ).toBe(false);
  });

  it('C 300 2025 sobre C 300 2024 suelta por año', () => {
    expect(
      fila1Nueva({
        resumen: resumenCon(
          'SOLICITUD ACTUAL:\nCliente pregunta el C 300 2025.\nPide otras: no',
          'C 300 2025',
        ),
        customerText: 'C 300 2025',
        lastAssistantText: '',
        car: c300,
        otroEsLaMostrada: null,
      }),
    ).toEqual({ suelta: true, motivo: 'otro_anio_version_color' });
  });

  it('3008 sobre 3008N sigue por prefijo', () => {
    expect(
      fila1Nueva({
        resumen: resumenCon('SOLICITUD ACTUAL:\nCliente nombra 3008.\nPide otras: no', '3008'),
        customerText: '3008',
        lastAssistantText: '',
        car: peugeot3008n,
        otroEsLaMostrada: null,
      }),
    ).toEqual({ suelta: false, motivo: 'misma_por_fila' });
  });

  it('2008 sobre 3008N suelta', () => {
    expect(
      fila1Nueva({
        resumen: resumenCon('SOLICITUD ACTUAL:\nCliente nombra 2008.\nPide otras: no', '2008'),
        customerText: '2008',
        lastAssistantText: '',
        car: peugeot3008n,
        otroEsLaMostrada: false,
      }).suelta,
    ).toBe(true);
  });

  it('dmax y d max siguen en D-MAX', () => {
    for (const valor of ['dmax', 'd max']) {
      expect(
        fila1Nueva({
          resumen: resumenCon('SOLICITUD ACTUAL:\nCliente nombra la unidad.\nPide otras: no', valor),
          customerText: valor,
          lastAssistantText: '',
          car: dmax,
          otroEsLaMostrada: null,
        }),
      ).toEqual({ suelta: false, motivo: 'misma_por_fila' });
    }
  });

  it('Santa Fe sobre Sportage suelta', () => {
    expect(
      fila1Nueva({
        resumen: resumenCon(
          'SOLICITUD ACTUAL:\nCliente pregunta por Santa Fe.\nPide otras: no',
          'Santa Fe',
        ),
        customerText: 'Santa Fe',
        lastAssistantText: '',
        car: sportage,
        otroEsLaMostrada: false,
      }),
    ).toEqual({ suelta: true, motivo: 'otro_vehiculo' });
  });

  it('Sportage sobre Sportage LX sigue', () => {
    expect(
      fila1Nueva({
        resumen: resumenCon(
          'SOLICITUD ACTUAL:\nCliente nombra Sportage.\nPide otras: no',
          'Sportage',
        ),
        customerText: 'Sportage',
        lastAssistantText: '',
        car: sportageLx,
        otroEsLaMostrada: null,
      }),
    ).toEqual({ suelta: false, motivo: 'misma_por_fila' });
  });

  it('sin línea Otro vehículo la fila 1 no suelta', () => {
    expect(
      fila1Nueva({
        resumen: 'SOLICITUD ACTUAL:\nCliente quiere un Aveo.\nPide otras: no',
        customerText: 'quiero un Aveo',
        lastAssistantText: '',
        car: sportage,
        otroEsLaMostrada: null,
      }),
    ).toEqual({ suelta: false, motivo: 'sin_otro' });
    expect(
      fila1Nueva({
        resumen: '',
        customerText: 'Aveo',
        lastAssistantText: '',
        car: sportage,
        otroEsLaMostrada: null,
      }).suelta,
    ).toBe(false);
  });
});

describe('decideStayOnShown', () => {
  it('uno blanco sobre mostrada roja suelta', () => {
    expect(
      decideStayOnShown({
        text: 'uno blanco',
        resumen: resumenCon(
          'SOLICITUD ACTUAL:\nCliente pide otro color.\nPide otro color: sí\nPide otras: no',
          'no',
        ),
        car: dmax,
        lexicon: TEST_LEXICON,
      }),
    ).toEqual({ stay: false, motivo: 'otro_color' });
  });

  it('Pide otras: sí suelta', () => {
    expect(
      decideStayOnShown({
        text: 'q otras tienen',
        resumen: resumenCon(
          'SOLICITUD ACTUAL:\nCliente quiere otras similares.\nPide otras: sí',
          'no',
        ),
        car: sportage,
        lexicon: TEST_LEXICON,
      }),
    ).toEqual({ stay: false, motivo: 'pide_otras' });
  });

  it('caja manual sobre automática suelta', () => {
    expect(
      decideStayOnShown({
        text: 'y en manual?',
        resumen: resumenCon(
          'SOLICITUD ACTUAL:\nCliente quiere caja manual.\nCaja de compra: manual\nPide otras: no',
          'no',
        ),
        car: c300,
        lexicon: mercedesLexicon,
      }),
    ).toEqual({ stay: false, motivo: 'caja' });
  });

  it('sí + Premiere 2020 suelta la D-Max', () => {
    expect(
      decideStayOnShown({
        text: 'sí',
        resumen: resumenCon(
          'SOLICITUD ACTUAL:\nCliente acepta esa unidad.\nPide otras: no',
          'Premiere 2020',
        ),
        lastAssistantText: 'Tenemos la Premiere 2020 si le interesa',
        car: dmax,
        lexicon: TEST_LEXICON,
        otroEsLaMostrada: null,
      }).stay,
    ).toBe(false);
  });
});

const c300Ficha = [
  {
    role: 'assistant' as const,
    content:
      'Estimado, el Mercedes Benz C 300 AMG Line AC 2.0 4p 4x2 automático 2024 blanco, con 25842 km, está en excelente estado. Su $61,990.',
  },
];
const sportageFicha = [
  {
    role: 'assistant' as const,
    content: 'Estimado, tenemos disponible un Kia Sportage R GTI 2019 plateado, con 64000 km.',
  },
];

const conversaciones20: {
  id: number;
  name: string;
  stay: boolean;
  otro: string;
  input: Parameters<typeof decideStayOnShown>[0];
}[] = [
  {
    id: 1,
    name: 'C 300: audio todavía lo tienen',
    stay: true,
    otro: 'no',
    input: {
      text: 'todavía lo tienen?',
      pedido: 'Mercedes C 300 AMG Line 2024',
      resumen: resumenCon(
        'SOLICITUD ACTUAL:\nCliente pregunta si todavía tienen el Mercedes C 300 AMG Line 2024.\nPide otras: no',
        'no',
      ),
      history: c300Ficha,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 2,
    name: 'C 300: nombra otra vez el mismo 2024',
    stay: true,
    otro: 'mercedes c 300 2024',
    input: {
      text: 'tienen el mercedes c 300 2024?',
      pedido: 'Mercedes Benz C 300 AMG Line 2024',
      resumen: resumenCon('SOLICITUD ACTUAL:\nCliente pregunta por esa unidad.\nPide otras: no', 'mercedes c 300 2024'),
      history: c300Ficha,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 3,
    name: 'C 300: solo ok',
    stay: true,
    otro: 'no',
    input: {
      text: 'ok',
      resumen: resumenCon('SOLICITUD ACTUAL:\nCliente confirma.\nPide otras: no', 'no'),
      history: c300Ficha,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 4,
    name: 'C 300: precio',
    stay: true,
    otro: 'no',
    input: {
      text: 'y el precio?',
      resumen: resumenCon('SOLICITUD ACTUAL:\nCliente quiere el precio.\nPide otras: no', 'no'),
      history: c300Ficha,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 5,
    name: 'C 300: dónde verla',
    stay: true,
    otro: 'no',
    input: {
      text: 'dónde queda para ir a verla?',
      resumen: resumenCon('SOLICITUD ACTUAL:\nCliente quiere la ubicación.\nPide otras: no', 'no'),
      history: c300Ficha,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 6,
    name: 'C 300: crédito',
    stay: true,
    otro: 'no',
    input: {
      text: 'me ayudan a ver si califico al crédito?',
      resumen: resumenCon('SOLICITUD ACTUAL:\nCliente pregunta si califica.\nPide otras: no', 'no'),
      history: c300Ficha,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 7,
    name: 'C 300: visita mañana',
    stay: true,
    otro: 'no',
    input: {
      text: 'puedo ir mañana?',
      resumen: resumenCon('SOLICITUD ACTUAL:\nCliente quiere ir mañana.\nPide otras: no', 'no'),
      history: c300Ficha,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 8,
    name: 'C 300: me interesa ese',
    stay: true,
    otro: 'no',
    input: {
      text: 'me interesa ese',
      resumen: resumenCon('SOLICITUD ACTUAL:\nCliente acepta esa unidad.\nPide otras: no', 'no'),
      history: c300Ficha,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 9,
    name: 'C 300: cámara',
    stay: true,
    otro: 'no',
    input: {
      text: 'está en buen estado? tiene cámara?',
      resumen: resumenCon(
        'SOLICITUD ACTUAL:\nCliente pregunta estado y cámara del C 300.\nPide otras: no',
        'no',
      ),
      history: c300Ficha,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 10,
    name: 'C 300: esa blanca',
    stay: true,
    otro: 'no',
    input: {
      text: 'sí, esa blanca',
      pedido: 'Mercedes Benz C 300 AMG Line 2024 blanco',
      resumen: resumenCon('SOLICITUD ACTUAL:\nCliente acepta esa blanca.\nPide otras: no', 'no'),
      history: c300Ficha,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 11,
    name: 'Sportage: ok gracias',
    stay: true,
    otro: 'no',
    input: {
      text: 'ok gracias',
      resumen: resumenCon('SOLICITUD ACTUAL:\nCliente agradece.\nPide otras: no', 'no'),
      history: sportageFicha,
      car: sportage,
      lexicon: TEST_LEXICON,
    },
  },
  {
    id: 12,
    name: 'Sportage: precio de este automático',
    stay: true,
    otro: 'no',
    input: {
      text: 'Cual es el precio d este automático',
      resumen: resumenCon('SOLICITUD ACTUAL:\nCliente quiere el precio.\nPide otras: no', 'no'),
      history: sportageFicha,
      car: sportage,
      lexicon: TEST_LEXICON,
    },
  },
  {
    id: 13,
    name: 'C 300 2025: otro año',
    stay: false,
    otro: 'c 300 2025',
    input: {
      text: 'y el c 300 2025?',
      pedido: 'Mercedes C 300 2025',
      resumen: resumenCon(
        'SOLICITUD ACTUAL:\nCliente pregunta el C 300 2025.\nPide otras: no',
        'c 300 2025',
      ),
      history: c300Ficha,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 14,
    name: 'C 300 → Hilux',
    stay: false,
    otro: 'Hilux',
    input: {
      text: 'mejor una Hilux',
      resumen: resumenCon(
        'SOLICITUD ACTUAL:\nCliente quiere una Hilux.\nPide otras: no',
        'Hilux',
      ),
      history: c300Ficha,
      car: c300,
      lexicon: TEST_LEXICON,
    },
  },
  {
    id: 15,
    name: 'Sportage → Tucson',
    stay: false,
    otro: 'tucson',
    input: {
      text: 'tienen tucson?',
      resumen: resumenCon(
        'SOLICITUD ACTUAL:\nCliente pregunta por tucson.\nPide otras: no',
        'tucson',
      ),
      history: sportageFicha,
      car: sportage,
      lexicon: TEST_LEXICON,
    },
  },
  {
    id: 16,
    name: 'C 300: otro color rojo',
    stay: false,
    otro: 'no',
    input: {
      text: 'lo tienen en rojo?',
      resumen: resumenCon(
        'SOLICITUD ACTUAL:\nCliente pide otro color.\nPide otro color: sí\nPide otras: no',
        'no',
      ),
      history: c300Ficha,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 17,
    name: 'C 300: pide manual',
    stay: false,
    otro: 'no',
    input: {
      text: 'y en manual?',
      resumen: resumenCon(
        'SOLICITUD ACTUAL:\nCliente quiere manual.\nCaja de compra: manual\nPide otras: no',
        'no',
      ),
      history: c300Ficha,
      car: c300,
      lexicon: mercedesLexicon,
    },
  },
  {
    id: 18,
    name: 'Sportage: pide otras',
    stay: false,
    otro: 'no',
    input: {
      text: 'q otras tienen porfabor',
      resumen: resumenCon(
        'SOLICITUD ACTUAL:\nCliente quiere otras similares.\nPide otras: sí',
        'no',
      ),
      history: sportageFicha,
      car: sportage,
      lexicon: TEST_LEXICON,
    },
  },
  {
    id: 19,
    name: 'Sportage: presupuesto',
    stay: false,
    otro: 'no',
    input: {
      text: 'Dispongo de 10.000$',
      resumen: resumenCon(
        'SOLICITUD ACTUAL:\nCliente quiere ver qué cabe en 10000.\nTope de contado: 10000',
        'no',
      ),
      history: sportageFicha,
      car: sportage,
      lexicon: TEST_LEXICON,
    },
  },
  {
    id: 20,
    name: 'Sportage → Seltos',
    stay: false,
    otro: 'seltos',
    input: {
      text: 'y el seltos?',
      resumen: resumenCon(
        'SOLICITUD ACTUAL:\nCliente pregunta por seltos.\nPide otras: no',
        'seltos',
      ),
      history: sportageFicha,
      car: sportage,
      lexicon: TEST_LEXICON,
    },
  },
];

describe('20 conversaciones con línea Otro vehículo', () => {
  it.each(conversaciones20)('$id. $name', ({ stay, input }) => {
    expect(decideStayOnShown(input).stay).toBe(stay);
  });
});

describe('mismaUnidadPorFila y evidenciaReal', () => {
  it('santafe pegado cubre santa fe', () => {
    expect(evidenciaReal('Santa Fe', 'quiero una santafe', '')).toBe(true);
    expect(evidenciaReal('santafe', 'quiero una santa fe', '')).toBe(true);
  });

  it('dmax pega D-MAX', () => {
    expect(mismaUnidadPorFila('dmax', dmax)).toBe(true);
    expect(mismaUnidadPorFila('d max', dmax)).toBe(true);
  });

  it('2008 con 3008N y year null suelta', () => {
    const car = { ...peugeot3008n, year: null, model: '3008n' };
    expect(mismaUnidadPorFila('2008', car)).toBe(false);
    expect(
      fila1Nueva({
        resumen: resumenCon('SOLICITUD ACTUAL:\nCliente nombra 2008.\nPide otras: no', '2008'),
        customerText: '2008',
        lastAssistantText: '',
        car,
        otroEsLaMostrada: false,
      }).suelta,
    ).toBe(true);
  });

  it('2008 con Peugeot 2008 y year null sigue', () => {
    const car: InterestedCarSnapshot = {
      inventoryId: 'p2008',
      brand: 'peugeot',
      model: '2008',
      year: null,
      price: 18900,
    };
    expect(mismaUnidadPorFila('2008', car)).toBe(true);
    expect(
      fila1Nueva({
        resumen: resumenCon('SOLICITUD ACTUAL:\nCliente nombra 2008.\nPide otras: no', '2008'),
        customerText: '2008',
        lastAssistantText: '',
        car,
        otroEsLaMostrada: null,
      }),
    ).toEqual({ suelta: false, motivo: 'misma_por_fila' });
  });

  it('Sportage 2022 con mostrada 2022 sigue', () => {
    const car = { ...sportage, year: 2022, model: 'sportage lx' };
    expect(mismaUnidadPorFila('Sportage 2022', car)).toBe(true);
    expect(
      fila1Nueva({
        resumen: resumenCon(
          'SOLICITUD ACTUAL:\nCliente nombra Sportage 2022.\nPide otras: no',
          'Sportage 2022',
        ),
        customerText: 'Sportage 2022',
        lastAssistantText: '',
        car,
        otroEsLaMostrada: null,
      }).suelta,
    ).toBe(false);
  });

  it('Sportage 2020 con mostrada 2022 suelta', () => {
    const car = { ...sportage, year: 2022, model: 'sportage lx' };
    expect(mismaUnidadPorFila('Sportage 2020', car)).toBe(false);
    expect(
      fila1Nueva({
        resumen: resumenCon(
          'SOLICITUD ACTUAL:\nCliente nombra Sportage 2020.\nPide otras: no',
          'Sportage 2020',
        ),
        customerText: 'Sportage 2020',
        lastAssistantText: '',
        car,
        otroEsLaMostrada: false,
      }).suelta,
    ).toBe(true);
  });
});

describe('debeConsultarRpcOtro', () => {
  it('consulta si hay otro con evidencia y no es la misma por fila', () => {
    expect(debeConsultarRpcOtro(dmax, 'Santa Fe', true, false)).toBe(true);
    expect(debeConsultarRpcOtro(dmax, 'Santa Fe', false, false)).toBe(false);
    expect(debeConsultarRpcOtro(null, 'Santa Fe', true, false)).toBe(false);
  });

  it('un error del RPC no rompe y deja otroEsLaMostrada null', async () => {
    const rpc = await consultarOtroEsLaMostrada({
      otro: 'Santa Fe',
      inventoryId: dmax.inventoryId,
      embed: async () => {
        throw new Error('embed falló');
      },
      match: async () => {
        throw new Error('rpc falló');
      },
    });
    expect(rpc.otroEsLaMostrada).toBeNull();
  });
});
