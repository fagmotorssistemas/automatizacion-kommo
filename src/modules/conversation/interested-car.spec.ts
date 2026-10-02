import {
  customerNamedAnotherShownCar,
  decideStayOnShown,
  followsShownCar,
  formatInterestedCar,
  historyPresentedFicha,
  isFichaRecoveryPing,
  leftShownCar,
  refersToInterestedCar,
  sameShownUnitAsk,
  stayBanderaSinEvidencia,
  vehicleLabelFitsCar,
} from './interested-car';
import { formatStayLog } from './otro-vehiculo';
import { TEST_LEXICON } from './test-lexicon';
import { KM_PER_YEAR, yearsOfUse } from '../catalog/mileage';

const explorer = {
  inventoryId: 'exp-1',
  brand: 'ford',
  model: 'explorer xlt ac 3.5 5p 4x4',
  year: 2018,
  price: 33990,
};

const sportage = {
  inventoryId: 'plata-1',
  brand: 'kia',
  model: 'sportage r gti 2019 ta',
  year: 2019,
  price: 22900,
  typeBody: 'jeep',
};

const picanto = {
  inventoryId: 'picanto-1',
  brand: 'kia',
  model: 'picanto lx ac 1.2',
  year: 2023,
  price: 15990,
  typeBody: 'hatchback',
};

describe('vehículo de interés', () => {
  it.each([
    {
      shown: sportage,
      text: 'Hola. Me interesa el Hyundai Santa Fe 2018',
    },
    {
      shown: explorer,
      text: 'Buenas noches precio del vehículo creta',
    },
    {
      shown: sportage,
      text: 'Me interesa el Kia Rio',
    },
    {
      shown: {
        inventoryId: 'sf-2015',
        brand: 'hyundai',
        model: 'santa fe dm 7pas ac 2.4 5p 4x2',
        year: 2015,
      },
      text: 'Hola. Me interesa el Hyundai Santa Fe 2018',
    },
  ])('nombró otro carro que el mostrado: $text', ({ shown, text }) => {
    expect(
      customerNamedAnotherShownCar(text, shown, TEST_LEXICON),
    ).toBe(true);
    expect(
      customerNamedAnotherShownCar('Sí, por favor', shown, TEST_LEXICON),
    ).toBe(false);
  });

  it('el hilo sigue aunque no use este/precio/automático', () => {
    expect(
      followsShownCar({
        text: 'tiene cámara de reversa?',
        resumen:
          'RESUMEN PREVIO:\nVehículo: Kia Sportage 2019 plateado\nSOLICITUD ACTUAL:\nCliente quiere saber si tiene cámara.',
        history: [
          { role: 'assistant', content: 'Le mandé las fotos del Sportage plateado.' },
        ],
        car: sportage,
      }),
    ).toBe(true);
    expect(
      followsShownCar({
        text: 'y tiene cámara de reversa?',
        resumen:
          'RESUMEN PREVIO:\nVehículo: Sportage plateado\nSOLICITUD ACTUAL:\nCliente quiere saber si tiene cámara.',
        history: [
          { role: 'assistant', content: 'Le mandé las fotos del Sportage plateado.' },
        ],
        car: sportage,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(true);
    expect(followsShownCar({ text: 'puedo ir el sábado?', car: sportage })).toBe(
      true,
    );
    expect(followsShownCar({ text: 'ok', car: sportage })).toBe(true);
    expect(followsShownCar({ text: 'Me interesa', car: sportage })).toBe(true);
    expect(
      followsShownCar({
        text: 'Cual es el precio d este automático',
        car: sportage,
      }),
    ).toBe(true);
    expect(
      leftShownCar({
        text: 'Quería el precio del Nissan ok gracias',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere el precio de un Nissan.\nOtro vehículo: Nissan',
        car: sportage,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(true);
    expect(
      leftShownCar({
        text: 'No me interesa el precio del Nissan',
        resumen:
          'SOLICITUD ACTUAL:\nCliente no le interesa el Nissan.\nOtro vehículo: Nissan',
        car: sportage,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(true);
    expect(
      leftShownCar({
        text: 'No me interesa el Kia, quiero el Nissan',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere el Nissan.\nOtro vehículo: Nissan',
        car: sportage,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(true);
  });

  it('se suelta si pide un modelo que no está en patio', () => {
    const patioKia = {
      ...picanto,
      typeBody: 'sedan',
    };
    expect(
      leftShownCar({
        text: 'Si el picanto es muy pequeño el Kia sonet me interesa del año 2021\nO 2022',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere información sobre un Kia Sonet año 2021 o 2022.\nOtro vehículo: Kia Sonet',
        car: patioKia,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(true);
    expect(
      followsShownCar({
        text: 'Si el picanto es muy pequeño el Kia sonet me interesa del año 2021\nO 2022',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere información sobre un Kia Sonet año 2021 o 2022.\nOtro vehículo: Kia Sonet',
        car: patioKia,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(false);
  });

  it('se suelta si el mensaje o el resumen piden otro carro', () => {
    expect(
      followsShownCar({
        text: 'Hilux',
        resumen: 'SOLICITUD ACTUAL:\nCliente quiere una Hilux.\nOtro vehículo: Hilux',
        car: sportage,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(false);
    expect(
      leftShownCar({
        text: 'Hilux',
        resumen: 'SOLICITUD ACTUAL:\nCliente quiere una Hilux.\nOtro vehículo: Hilux',
        car: sportage,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(true);
    expect(
      leftShownCar({
        text: 'un chevrolet blanco',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere un Chevrolet blanco.\nTipo de patio: suv\nPide otras: sí',
        car: picanto,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(true);
    expect(
      leftShownCar({
        text: 'Tiene el hyundai y 10',
        resumen:
          'SOLICITUD ACTUAL:\nCliente pregunta por hyundai.\nOtro vehículo: hyundai',
        car: sportage,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(true);
    expect(
      leftShownCar({
        text: 'Dispongo de 10.000$',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere ver qué cabe en 10000.\nTope de contado: 10000',
        car: { ...sportage, price: 22900 },
      }),
    ).toBe(true);
    expect(
      leftShownCar({
        text: 'Qué vehículo tiene por 10.000$',
        resumen:
          'SOLICITUD ACTUAL:\nCliente pregunta qué hay por 10000.\nTope de contado: 10000',
        car: { ...sportage, price: 22900 },
      }),
    ).toBe(true);
    expect(
      followsShownCar({
        text: 'El precio es negociable',
        resumen:
          'SOLICITUD ACTUAL:\nCliente pregunta si el precio de ESA unidad es negociable.\nPide negociar: sí\nPide otras: no\nTope de contado: 10000',
        car: { ...sportage, price: 22900 },
      }),
    ).toBe(true);
    expect(
      followsShownCar({
        text: 'Donde queda el concesionario',
        resumen:
          'SOLICITUD ACTUAL:\nCliente pide la ubicación de la concesionaria.\nPide ubicación: sí\nPide otras: no\nTope de contado: 10000',
        car: { ...sportage, price: 22900 },
      }),
    ).toBe(true);
    expect(
      followsShownCar({
        text: 'Cuál es el precio',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere el precio de ESA unidad.\nPide precio: sí\nPide otras: no\nTope de contado: 10000',
        car: { ...sportage, price: 22900 },
      }),
    ).toBe(true);
    expect(
      followsShownCar({
        text: 'cuántos km tiene?',
        resumen:
          'SOLICITUD ACTUAL:\nCliente pregunta cuántos km tiene ESA unidad.\nPide otras: no\nTope de contado: 10000',
        car: { ...sportage, price: 22900 },
      }),
    ).toBe(true);
    expect(
      followsShownCar({
        text: 'ok',
        resumen:
          'SOLICITUD ACTUAL:\nCliente sigue con ESA unidad.\nPide otras: no\nTope de contado: 10000',
        car: { ...sportage, price: 22900 },
      }),
    ).toBe(true);
    expect(
      followsShownCar({
        text: 'sí, esa',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere ver una Hilux.\nOtro vehículo: Hilux',
        history: [
          {
            role: 'assistant',
            content:
              'Estimado, tenemos disponible una Toyota Hilux SR 2023 color plateado, con 13086 km.',
          },
        ],
        car: sportage,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(false);
    expect(
      followsShownCar({
        text: 'sí, esa',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere ver una Hilux.\nOtro vehículo: Hilux',
        history: [
          {
            role: 'assistant',
            content:
              'Estimado, tenemos disponible un Kia Sportage R GTI 2019 color plateado.',
          },
        ],
        car: sportage,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(true);
    expect(
      leftShownCar({
        text: 'Q otras tienen porfabor',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere otras camionetas similares.\nPide otras: sí',
        history: [
          {
            role: 'assistant',
            content:
              'El Ford F150 Lariat 2018 color café está en nuestra concesionaria en Cuenca, Av. España 6-73 y Sevilla.',
          },
          {
            role: 'assistant',
            content:
              'El Ford F150 Lariat 2018 color café con 49441 km es un carro cuidado y en buen estado.',
          },
          {
            role: 'assistant',
            content:
              'Actualmente no tenemos Ford Super Duty 250 en nuestro inventario. Le puedo ayudar con más información sobre la Ford F150 Lariat 2018 color café que mencionamos anteriormente o mostrarle otras camionetas similares si lo desea.',
          },
        ],
        car: {
          inventoryId: '06852abe-5a25-41cb-ab8e-3f7a0cb72296',
          brand: 'ford',
          model: 'f150 lariat sc ecoboost ac 3.5 cd',
          year: 2018,
          price: 48990,
          color: 'cafe',
        },
      }),
    ).toBe(true);
    expect(
      followsShownCar({
        text: 'Q otras tienen porfabor',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere el precio de la Lariat.\nPide otras: no',
        car: sportage,
      }),
    ).toBe(true);
    expect(
      refersToInterestedCar(
        'Gran vitara 3 puertas',
        explorer,
        TEST_LEXICON,
        'SOLICITUD ACTUAL:\nCliente quiere una Gran vitara 3 puertas.\nOtro vehículo: Gran vitara',
      ),
    ).toBe(false);
    const jetourT1 = {
      inventoryId: 't1-2026',
      brand: 'jetour',
      model: 't1 ac 2.0 5p 4x4 ta',
      year: 2026,
      price: 28990,
    };
    expect(
      leftShownCar({
        text: 'el T1 el precio',
        car: jetourT1,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(false);
    const runner = {
      inventoryId: 'runner-2004',
      brand: 'toyota',
      model: '4 runner 4x2 t/a',
      year: 2004,
      price: 21400,
    };
    expect(
      leftShownCar({
        text: 'Precio\nNo era 4x4?',
        resumen:
          'RESUMEN PREVIO:\nVehículo: Toyota 4 runner 4x2 t/a 2004\nSOLICITUD ACTUAL:\nCliente quiere saber el precio del Toyota 4runner mostrado y confirmar la tracción 4x2 vs 4x4.\nPide otras: no\nTiene duda: sí\nTracción pedida: no',
        car: runner,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(false);
    expect(
      leftShownCar({
        text: 'Hermoso el precio en donde estan ubicados',
        resumen:
          'RESUMEN PREVIO:\nVehículo: Jetour T1\nSOLICITUD ACTUAL:\nCliente quiere saber la ubicación del vehículo Jetour T1.\nPide otras: no',
        car: jetourT1,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(false);
    expect(
      followsShownCar({
        text: 'Hermoso el precio en donde estan ubicados',
        resumen:
          'RESUMEN PREVIO:\nVehículo: Jetour T1\nSOLICITUD ACTUAL:\nCliente quiere saber la ubicación del vehículo Jetour T1.\nPide otras: no',
        history: [
          {
            role: 'assistant',
            content:
              'tenemos disponible un Jetour T1 AC 2.0 5 puertas, 4x4, año 2026 color blanco, con 14,343 km.',
          },
        ],
        car: jetourT1,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(true);
  });

  it('otras mañana no suelta la mostrada', () => {
    expect(
      leftShownCar({
        text: 'para ver otras opciones mañana',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere ver otras.\nPide otras: sí',
        car: sportage,
      }),
    ).toBe(false);
  });

  it('otro año o otra caja no es la misma unidad', () => {
    expect(
      followsShownCar({
        text: 'el Sportage 2014 más barato',
        resumen:
          'SOLICITUD ACTUAL:\nCliente pide el Sportage 2014.\nOtro vehículo: Sportage 2014',
        car: sportage,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(false);
    expect(followsShownCar({ text: 'y en manual?', resumen: 'SOLICITUD ACTUAL:\nCliente quiere caja manual.\nCaja de compra: manual\nPide otras: no', car: sportage })).toBe(
      false,
    );
  });

  it('premiere 2020 suelta la D-Max 2022 que ya mostramos', () => {
    const dmax2022 = {
      inventoryId: 'dmax-vino',
      brand: 'chevrolet',
      model: 'd-max crdi 2.5 cd 4x4 tm diesel',
      year: 2022,
      price: 28900,
      color: 'vino',
    };
    expect(
      followsShownCar({
        text: 'estoy buscando la premiere 2020',
        resumen:
          'SOLICITUD ACTUAL:\nCliente busca la Premiere 2020.\nOtro vehículo: premiere 2020',
        car: dmax2022,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(false);
    expect(
      followsShownCar({
        text: 'sí',
        resumen:
          'RESUMEN PREVIO:\nVehículo: D-Max 2022 vino\nSOLICITUD ACTUAL:\nCliente confirma la D-Max.\nOtro vehículo: no',
        history: [
          {
            role: 'assistant',
            content:
              'Actualmente estábamos viendo la Chevrolet D-max CRDi 2.5 CD 4x4 2022 color vino. ¿Le gustaría más información o detalles sobre esta camioneta?',
          },
        ],
        car: dmax2022,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(true);
    expect(
      followsShownCar({
        text: 'sí',
        resumen:
          'RESUMEN PREVIO:\nVehículo: D-Max 2022 vino\nSOLICITUD ACTUAL:\nCliente busca la Premiere 2020.\nOtro vehículo: Premiere 2020',
        history: [
          {
            role: 'assistant',
            content: 'Tenemos disponible una Premiere 2020.',
          },
        ],
        car: dmax2022,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(false);
    expect(followsShownCar({ text: 'cuántos km tiene?', car: dmax2022 })).toBe(
      true,
    );
  });

  it('cabina simple suelta la Hilux cd que ya mostramos', () => {
    const hilux = {
      inventoryId: 'hilux-2026',
      brand: 'toyota',
      model: 'hilux 2026 4x4',
      year: 2026,
      price: 42000,
      typeBody: 'doble cabina',
    };
    expect(
      followsShownCar({
        text: 'Busco una camioneta 4x4 cabina simple',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere camioneta cabina simple 4x4.\nCabina: simple\nTracción pedida: 4x4\nTipo de patio: camioneta\nPide otras: no',
        car: {
          ...hilux,
          model: 'hilux cd 2.4 4x4 tm',
        },
      }),
    ).toBe(false);
    expect(followsShownCar({ text: 'cuántos km tiene?', car: hilux })).toBe(
      true,
    );
  });

  it('4x4 suelta la cabina simple 4x2 que ya mostramos', () => {
    const dmaxCs = {
      inventoryId: 'dmax-2020-cs',
      brand: 'chevrolet',
      model: 'd-max crdi 2.5 cs 4x2 tm diesel',
      year: 2020,
      price: 21900,
      typeBody: 'cabina simple',
    };
    expect(
      followsShownCar({
        text: 'Tal vez dispone en cabina simple pero 4x4?',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere cabina simple 4x4.\nCabina: simple\nTracción pedida: 4x4\nPide otras: no',
        car: dmaxCs,
      }),
    ).toBe(false);
    expect(
      followsShownCar({
        text: 'No era 4x4?',
        resumen:
          'SOLICITUD ACTUAL:\nCliente confirma si la unidad es 4x4.\nTiene duda: sí\nPide otras: no\nTracción pedida: no',
        car: dmaxCs,
      }),
    ).toBe(true);
    expect(followsShownCar({ text: 'cuántos km tiene?', car: dmaxCs })).toBe(
      true,
    );
  });

  it('la simulación sigue con el Explorer', () => {
    expect(
      refersToInterestedCar(
        'Me puede hacer la simulación 60 % entrada y a 36 meses',
        explorer,
      ),
    ).toBe(true);
    expect(refersToInterestedCar('Este vehiculo', explorer)).toBe(true);
    expect(refersToInterestedCar('el precio x favor', explorer)).toBe(true);
  });

  it('5p y 4x4 no se etiquetan como caja', () => {
    const text = formatInterestedCar(explorer);
    expect(text).toContain('caja=sin dato');
    expect(text).toContain('puertas=5');
    expect(text).toContain('tracción=4x4');
    expect(text).not.toMatch(/caja=4x4|caja=5p/i);
    expect(text).toMatch(/4p\/5p = puertas/i);
  });

  it('el precio queda interno hasta que el cliente lo pida', () => {
    expect(formatInterestedCar(explorer)).toContain('{{precio:u1}}');
    expect(formatInterestedCar(explorer)).toContain('($33990)');
    expect(formatInterestedCar(explorer)).toMatch(/escribe \{\{precio:u1\}\}/);
    expect(formatInterestedCar(explorer, true)).toContain('{{precio:u1}}');
    expect(formatInterestedCar(explorer)).toMatch(/Si no cambió de carro, sigue ESTA/i);
  });

  it('el km está para responderlo si lo pide, no para soltar la placa', () => {
    const text = formatInterestedCar({
      ...sportage,
      mileage: 144904,
      plateShort: 'L5',
    });
    expect(text).toContain('km=144904');
    expect(text).toMatch(/km vs año/i);
    expect(text).toContain('placa={{placa}} (matrícula: Loja)');
    expect(text).not.toMatch(/plate_short/i);
    expect(text).toMatch(/estos datos van etiquetados/i);
    expect(text).not.toMatch(/La placa es/i);
  });

  it('Ranger 2024 con 11061 km queda en el mínimo de 15.000 km/año', () => {
    const text = formatInterestedCar({
      inventoryId: 'ranger-xl-2024',
      brand: 'ford',
      model: 'ranger xl',
      year: 2024,
      price: 44590,
      typeBody: 'doble cabina',
      mileage: 11061,
    });
    expect(text).toContain('km=11061');
    expect(text).toMatch(/mínimo/i);
    expect(text).toContain(String(yearsOfUse(2024) * KM_PER_YEAR));
    expect(text).toMatch(/20.?000/);
  });

  it('precio 0 es dato no cargado, no cero dólares', () => {
    const text = formatInterestedCar({
      ...sportage,
      price: 0,
    });
    expect(text).toMatch(/aún no cargado/i);
    expect(text).not.toMatch(/,\s*\$0\b/);
  });

  it('km 0 es dato no cargado, no cero kilómetros', () => {
    const text = formatInterestedCar({
      ...sportage,
      mileage: 0,
    });
    expect(text).toMatch(/aún no cargado/i);
    expect(text).not.toMatch(/^km=0$/m);
  });

  it('crédito del 3008 no suelta por el léxico 2008', () => {
    const peugeot3008n = {
      inventoryId: '62ebe610-3f42-4714-9939-1ab3380d1a18',
      brand: 'peugeot',
      model: '3008n act 16e ba6 ac 1.6 5p 4x2 ta',
      year: 2022,
      price: 22800,
      color: 'plata',
      typeBody: 'suv',
    };
    expect(
      leftShownCar({
        text: 'Pueden enviarme información, este, con cuanto de entrada, para cuantos meses',
        resumen:
          'RESUMEN PREVIO:\nVehículo: Peugeot 3008 2022\nSOLICITUD ACTUAL:\nCliente quiere la entrada y el plazo del Peugeot 3008 2022.\nPide crédito: sí\nPide otras: no\nCaja de compra: automática',
        car: peugeot3008n,
        lexicon: TEST_LEXICON,
        pedido: 'Peugeot 3008 2022',
      }),
    ).toBe(false);
    expect(
      decideStayOnShown({
        text: 'Pueden enviarme información, este, con cuanto de entrada, para cuantos meses',
        resumen:
          'RESUMEN PREVIO:\nVehículo: Peugeot 3008 2022\nSOLICITUD ACTUAL:\nCliente quiere la entrada y el plazo del Peugeot 3008 2022.\nPide crédito: sí\nPide otras: no\nCaja de compra: automática',
        car: peugeot3008n,
        lexicon: TEST_LEXICON,
        pedido: 'Peugeot 3008 2022',
        lastListed: true,
      }).stay,
    ).toBe(true);
    expect(
      leftShownCar({
        text: 'cuántos km tiene?',
        car: peugeot3008n,
      }),
    ).toBe(false);
    expect(
      leftShownCar({
        text: '¿esta es automática?',
        car: peugeot3008n,
      }),
    ).toBe(false);
    expect(
      leftShownCar({
        text: 'Me interesa el Kia Sportage',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere el Kia Sportage.\nOtro vehículo: Kia Sportage',
        car: peugeot3008n,
      }),
    ).toBe(true);
  });

  it('Peugeot 2008 no suelta la unidad 2022 de ese modelo', () => {
    const peugeot2008 = {
      inventoryId: 'p2008-2022',
      brand: 'peugeot',
      model: '2008 fin',
      year: 2022,
      price: 18900,
    };
    expect(
      followsShownCar({
        text: 'Hola. Me interesa el Peugeot 2008',
        car: peugeot2008,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(true);
  });

  it('Precio? sigue en el 2008 aunque el último mensaje sea el salesbot de fotos', () => {
    const peugeot2008 = {
      inventoryId: 'p2008-2022',
      brand: 'peugeot',
      model: '2008 fin',
      year: 2022,
      price: 18900,
      color: 'plomo',
      typeBody: 'jeep',
    };
    const ficha =
      'Buenas noches, estimado. Tenemos disponible un Peugeot 2008 2022 color plomo, con 95,848 km, caja manual y tracción 4x2. La placa es P8 Aquí tiene también las fotos del vehículo.';
    expect(
      leftShownCar({
        text: 'Precio?',
        resumen:
          'RESUMEN PREVIO:\nVehículo: Peugeot 2008 2022\nSOLICITUD ACTUAL:\nCliente quiere el precio del Peugeot 2008 2022.\nPide precio: sí\nCaja de compra: manual\nPide otras: no',
        history: [
          { role: 'user', content: 'Hola. Me interesa el Peugeot 2008 2022' },
          { role: 'assistant', content: ficha },
          { role: 'assistant', content: 'SalesBot (peugeot_2008_2022)' },
        ],
        car: peugeot2008,
        lexicon: TEST_LEXICON,
        pedido: 'Peugeot 2008 2022',
      }),
    ).toBe(false);
    expect(
      followsShownCar({
        text: 'Precio?',
        history: [
          { role: 'assistant', content: ficha },
          { role: 'assistant', content: 'SalesBot (peugeot_2008_2022)' },
        ],
        car: peugeot2008,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(true);
    expect(
      followsShownCar({
        text: 'Costo',
        resumen:
          'RESUMEN PREVIO:\nVehículo: Peugeot 2008 2022\nSOLICITUD ACTUAL:\nCliente quiere el precio del Peugeot 2008 2022.\nPide precio: sí\nPide otras: no',
        history: [{ role: 'assistant', content: ficha }],
        car: peugeot2008,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(true);
  });

  it('2000 de entrada no es otro año del carro', () => {
    expect(
      followsShownCar({
        text: 'Para 6 años',
        resumen:
          'SOLICITUD ACTUAL:\nCliente da 2000 de entrada a 6 años.\nPide crédito: sí',
        car: { ...sportage, year: 2020 },
      }),
    ).toBe(true);
  });

  it('otro color suelta la unidad mostrada', () => {
    expect(
      leftShownCar({
        text: 'No tienen otro color?',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere otro color del Sportage.\nPide otro color: sí',
        car: { ...sportage, color: 'plateado' },
      }),
    ).toBe(true);
    expect(
      followsShownCar({
        text: 'No tienen otro color?',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere otro color del Sportage.\nPide otro color: sí',
        car: { ...sportage, color: 'plateado' },
      }),
    ).toBe(false);
  });

  it('detecta si la ficha ya salió en el hilo o el resumen', () => {
    expect(
      historyPresentedFicha(
        [
          {
            role: 'assistant',
            content:
              'Estimado, tenemos disponible un Foton Tunland TM 2023 color plateado, con 113692 km, transmisión manual y tracción 4x4. Aquí tiene también las fotos del vehículo.',
          },
        ],
        'tunland tm',
      ),
    ).toBe(true);
    expect(
      historyPresentedFicha(
        [
          {
            role: 'assistant',
            content:
              'Le envié fotos de la Foton Tunland 2023, ¿le gustó o hay algo que le detiene?',
          },
        ],
        'tunland tm',
      ),
    ).toBe(false);
    expect(
      isFichaRecoveryPing(
        'Javier, ¿le gustó la Ford Explorer XLT 2018 que le envié o hay algo que le detiene? Escríbame si prefiere que le busque otra opción o más detalles.',
      ),
    ).toBe(true);
    expect(
      historyPresentedFicha(
        [{ role: 'assistant', content: 'Buen día, seré su asesor.' }],
        'tunland tm',
      ),
    ).toBe(false);
    expect(
      historyPresentedFicha([], 'tunland tm', 'Fotos enviadas. Cliente pide precio.'),
    ).toBe(true);
  });

  it('si pide la ficha de nuevo suelta la ficha completa, no km+mecánico', () => {
    const text = formatInterestedCar(
      { ...explorer, mileage: 113692, color: 'plateado', transmission: 'automatica' },
      false,
      { replayFicha: true },
    );
    expect(text).toMatch(/PIDIÓ DE NUEVO LA FICHA/i);
    expect(text).toContain('color=plateado');
    expect(text).toContain('caja=automática');
    expect(text).toContain('km=113692');
    expect(text).toMatch(/PROHIBIDO “tenemos disponible”/i);
    expect(text).not.toMatch(/La ficha YA se presentó/i);
  });

  it('si ya se dio la ficha el precio va justificado, no se vuelve a listar', () => {
    const text = formatInterestedCar(
      { ...explorer, mileage: 113692, color: 'plateado', transmission: 'manual' },
      true,
      { slimAfterFicha: true, skipMileageCare: true },
    );
    expect(text).toMatch(/ficha YA se presentó/i);
    expect(text).toContain('{{precio:u1}}');
    expect(text).toContain('($33990)');
    expect(text).toContain('km=113692');
    expect(text).toMatch(/escribe \{\{precio:u1\}\}/);
    expect(text).not.toContain('color=plateado');
    expect(text).not.toContain('caja=manual');
    expect(text).not.toMatch(/AL CLIENTE:.*mecánico/i);
    expect(
      formatInterestedCar(explorer, false, {
        slimAfterFicha: true,
        creditFollowUp: true,
      }),
    ).toMatch(/Pregunta con cuánto de entrada y a qué plazo/i);
    expect(
      formatInterestedCar(explorer, false, {
        slimAfterFicha: true,
        afterFicha: 'location',
      }),
    ).toMatch(/dónde verla/i);
    expect(
      formatInterestedCar(explorer, false, {
        slimAfterFicha: true,
        afterFicha: 'location',
      }),
    ).toMatch(/PROHIBIDO repetir/i);
    expect(
      formatInterestedCar(explorer, true, {
        slimAfterFicha: true,
        afterFicha: 'both',
      }),
    ).toMatch(/escribe \{\{precio:u1\}\} y, en la misma respuesta, dónde verla/i);
    expect(
      formatInterestedCar(explorer, false, {
        slimAfterFicha: true,
        afterFicha: 'doubt',
      }),
    ).toMatch(/Contesta la duda de ESA/i);
    const facts = formatInterestedCar(
      { ...explorer, color: 'blanco', transmission: 'manual', mileage: null },
      false,
      { slimAfterFicha: true, afterFicha: 'facts' },
    );
    expect(facts).toMatch(/Contesta AHORA lo que pregunta/i);
    expect(facts).toMatch(/no “tenemos disponible”/i);
    expect(facts).toMatch(/km=aún no cargado/i);
    expect(facts).not.toContain('color=blanco');
    expect(facts).not.toContain('caja=manual');
  });

  it('si pide furgoneta suelta el carro chico', () => {
    expect(
      leftShownCar({
        text: 'Por favor páseme furgonetas de 17 o 20 pasajeros',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere un vehículo GRANDE de 17 o 20 pasajeros.\nAsientos: 17\nTres filas: no\nPide otras: sí',
        car: picanto,
      }),
    ).toBe(true);
    expect(
      followsShownCar({
        text: 'tiene cámara de reversa?',
        car: picanto,
      }),
    ).toBe(true);
  });

  it('repetir la misma ficha (marca + AMG + año) sigue siendo esa unidad', () => {
    const c300 = {
      inventoryId: 'c300-1',
      brand: 'mercedes-benz',
      model: 'c 300 amg line ac 2.0 4p 4x2 automatico',
      year: 2024,
      price: 61990,
      color: 'blanco',
    };
    expect(
      sameShownUnitAsk(
        { family: 'c 300', year: 2024 },
        { model: c300.model, year: 2024 },
      ),
    ).toBe(true);
    expect(
      sameShownUnitAsk(
        { family: 'c 300', year: 2025 },
        { model: c300.model, year: 2024 },
      ),
    ).toBe(false);
    expect(
      leftShownCar({
        text: 'todavía lo tienen?',
        pedido: 'Mercedes C 300 AMG Line 2024',
        car: c300,
      }),
    ).toBe(false);
    expect(
      followsShownCar({
        text: 'todavía lo tienen?',
        pedido: 'Mercedes C 300 AMG Line 2024',
        car: c300,
      }),
    ).toBe(true);
  });

  it('el resumen plateado automático no cabe en la GTI roja manual', () => {
    const label = 'Sportage R automático plateado';
    expect(
      vehicleLabelFitsCar(
        label,
        {
          model: 'sportage r gti lx ac 2.0 5p 4x2 ta',
          color: 'plateado',
          transmission: 'automática',
        },
        TEST_LEXICON,
      ),
    ).toBe(true);
    expect(
      vehicleLabelFitsCar(
        label,
        {
          model: 'sportage r gti ac 2.0 5p 4x2',
          color: 'rojo',
          transmission: 'manual',
        },
        TEST_LEXICON,
      ),
    ).toBe(false);
    expect(
      leftShownCar({
        text: 'Precio',
        pedido: label,
        resumen:
          'SOLICITUD ACTUAL:\nCliente pide el Sportage R automático plateado.\nOtro vehículo: Sportage R automático plateado',
        car: {
          inventoryId: 'rojo',
          brand: 'kia',
          model: 'sportage r gti ac 2.0 5p 4x2',
          year: 2019,
          price: 22900,
          color: 'rojo',
          transmission: 'manual',
        },
        lexicon: TEST_LEXICON,
      }),
    ).toBe(true);
  });
});

describe('stay solo banderas', () => {
  const dmaxCs = {
    inventoryId: 'dmax-cs',
    brand: 'chevrolet',
    model: 'd-max crdi 2.5 cs 4x2 tm diesel',
    year: 2020,
    price: 21900,
    typeBody: 'cabina simple',
    color: 'blanco',
  };
  const sportageManual = {
    ...sportage,
    model: 'sportage r gti ac 2.0 5p 4x2',
    transmission: 'manual' as const,
    color: 'rojo',
  };

  it('le comento no suelta la SUV si Tipo de patio: no', () => {
    expect(
      decideStayOnShown({
        text: 'Estimada, le comento, yo salgo del trabajo a las 6',
        resumen:
          'SOLICITUD ACTUAL:\nCliente indica horario de salida.\nTipo de patio: no\nPide otras: no',
        car: sportage,
      }),
    ).toEqual({ stay: true, motivo: 'sigue' });
  });

  it('comento + toma C3 no suelta por caja ni tipo', () => {
    expect(
      decideStayOnShown({
        text: 'Le comento es un Citroën C3 2024 … caja automática',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere vendernos su Citroën C3 2024 automática.\nToma: sí\nTipo de patio: no\nCaja de compra: no\nPide otras: no',
        car: sportage,
      }).stay,
    ).toBe(true);
  });

  it('Año 2007 de la toma no suelta la Sportage', () => {
    expect(
      decideStayOnShown({
        text: 'Año 2007',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere vender su Hyundai sedán blanco año 2007.\nToma: sí\nTipo de patio: no\nPide otras: no\nToma ficha: Hyundai sedán no  no\nToma ya: marca=Hyundai; modelo=sedán; color=blanco; año=2007',
        car: sportage,
      }).stay,
    ).toBe(true);
  });

  it('crédito directo no suelta por el 4x4 de otra ficha', () => {
    expect(
      decideStayOnShown({
        text: 'Uds tiene crédito directo',
        resumen:
          'RESUMEN PREVIO:\nVehículo: Chevrolet D-Max CS 4x2\nSOLICITUD ACTUAL:\nCliente pregunta si hay crédito directo.\nPide crédito: sí\nTracción pedida: no\nPide otras: no\nFord Explorer XLT 5p 4x4',
        car: dmaxCs,
      }).stay,
    ).toBe(true);
  });

  it('doble cabina suelta la CS', () => {
    expect(
      decideStayOnShown({
        text: 'Necesito doble cabina',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere doble cabina.\nCabina: doble\nPide otras: no',
        car: dmaxCs,
      }),
    ).toEqual({ stay: false, motivo: 'cabina' });
  });

  it('¿es automática? no suelta la manual', () => {
    expect(
      decideStayOnShown({
        text: '¿es automática?',
        resumen:
          'SOLICITUD ACTUAL:\nCliente pregunta si la unidad es automática.\nCaja de compra: no\nPide otras: no',
        car: sportageManual,
      }).stay,
    ).toBe(true);
  });

  it('la quiero en automática suelta la manual', () => {
    expect(
      decideStayOnShown({
        text: 'la quiero en automática',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere automática.\nCaja de compra: automática\nPide otras: no',
        car: sportageManual,
      }),
    ).toEqual({ stay: false, motivo: 'caja' });
  });

  it('¿es 4x4? no suelta la 4x2', () => {
    expect(
      decideStayOnShown({
        text: '¿es 4x4?',
        resumen:
          'SOLICITUD ACTUAL:\nCliente pregunta si la unidad es 4x4.\nTracción pedida: no\nPide otras: no',
        car: dmaxCs,
      }).stay,
    ).toBe(true);
  });

  it('cabina simple pero 4x4 suelta la CS 4x2', () => {
    expect(
      decideStayOnShown({
        text: 'cabina simple pero 4x4',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere cabina simple 4x4.\nCabina: simple\nTracción pedida: 4x4\nPide otras: no',
        car: dmaxCs,
      }).stay,
    ).toBe(false);
  });

  it('¿tienen en blanco? suelta la roja', () => {
    expect(
      decideStayOnShown({
        text: '¿tienen en blanco?',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere en blanco.\nColor pedido: blanco\nPide otro color: no\nPide otras: no',
        car: sportageManual,
      }),
    ).toEqual({ stay: false, motivo: 'otro_color' });
  });

  it('¿de qué color es? no suelta', () => {
    expect(
      decideStayOnShown({
        text: '¿de qué color es?',
        resumen:
          'SOLICITUD ACTUAL:\nCliente pregunta el color de la unidad.\nColor pedido: no\nPide otro color: no\nPide otras: no',
        car: sportageManual,
      }).stay,
    ).toBe(true);
  });

  it('a) precio con Tipo de patio arrastrado no suelta la 4Runner', () => {
    const runner = {
      inventoryId: '4runner-2004',
      brand: 'toyota',
      model: '4 runner 4x2 t/a',
      year: 2004,
      price: 21400,
      typeBody: 'jeep',
      color: 'rojo',
    };
    const input = {
      text: '¿precio?',
      resumen:
        'SOLICITUD ACTUAL:\nCliente quiere el precio de ESA unidad.\nPide precio: sí\nPide otras: no\nTipo de patio: camioneta\nFalta vehículo: no',
      car: runner,
    };
    expect(decideStayOnShown(input)).toEqual({ stay: true, motivo: 'sigue' });
    expect(stayBanderaSinEvidencia(input)).toBe('Tipo de patio:camioneta');
    expect(
      formatStayLog({
        contactId: '1',
        inventory: runner.inventoryId,
        stay: true,
        motivo: 'sigue',
        banderaSinEvidencia: stayBanderaSinEvidencia(input),
        otro: null,
        evidencia: 'n/a',
        rpcRank1: null,
        rpcSim1: null,
        rpcSim2: null,
      }),
    ).toMatch(/bandera_sin_evidencia=Tipo de patio:camioneta/);
  });

  it('b) doble cabina suelta la CS con evidencia', () => {
    expect(
      decideStayOnShown({
        text: 'Necesito doble cabina',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere doble cabina.\nCabina: doble\nPide otras: no',
        car: dmaxCs,
      }),
    ).toEqual({ stay: false, motivo: 'cabina' });
  });

  it('c) la quiero en automático suelta la manual', () => {
    expect(
      decideStayOnShown({
        text: 'la quiero en automático',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere automática.\nCaja de compra: automática\nPide otras: no',
        car: sportageManual,
      }),
    ).toEqual({ stay: false, motivo: 'caja' });
  });

  it('d) sí al 4x4 que ofreció el bot suelta la 4x2', () => {
    expect(
      decideStayOnShown({
        text: 'sí',
        lastAssistantText: '¿la prefiere en 4x4?',
        resumen:
          'SOLICITUD ACTUAL:\nCliente acepta 4x4.\nTracción pedida: 4x4\nPide otras: no',
        car: dmaxCs,
      }).stay,
    ).toBe(false);
  });

  it('e) ¿tiene en blanco? suelta la roja', () => {
    expect(
      decideStayOnShown({
        text: '¿tiene en blanco?',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere en blanco.\nColor pedido: blanco\nPide otro color: no\nPide otras: no',
        car: sportageManual,
      }),
    ).toEqual({ stay: false, motivo: 'otro_color' });
  });

  it('f) precio con Color pedido arrastrado no suelta', () => {
    const input = {
      text: '¿precio?',
      resumen:
        'SOLICITUD ACTUAL:\nCliente quiere el precio.\nPide precio: sí\nColor pedido: blanco\nPide otro color: no\nPide otras: no',
      car: sportageManual,
    };
    expect(decideStayOnShown(input).stay).toBe(true);
    expect(stayBanderaSinEvidencia(input)).toBe('Color pedido:blanco');
  });

  it('a) automático en el texto suelta aunque Caja de compra sea manual', () => {
    expect(
      decideStayOnShown({
        text: 'No mi joven automático no disculpas',
        resumen:
          'SOLICITUD ACTUAL:\nCliente no quiere automática; pide manual.\nCaja de compra: manual\nPide otras: no',
        car: sportage,
      }),
    ).toEqual({ stay: false, motivo: 'caja' });
  });

  it('b) precio con Caja de compra arrastrada no suelta', () => {
    const input = {
      text: '¿precio?',
      resumen:
        'SOLICITUD ACTUAL:\nCliente quiere el precio de ESA unidad.\nPide precio: sí\nCaja de compra: manual\nPide otras: no',
      car: sportage,
    };
    expect(decideStayOnShown(input)).toEqual({ stay: true, motivo: 'sigue' });
    expect(stayBanderaSinEvidencia(input)).toBe('Caja de compra:manual');
  });

  it('c) precio con Tipo de patio hatchback arrastrado no suelta', () => {
    expect(
      decideStayOnShown({
        text: '¿precio?',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere el precio de ESA unidad.\nPide precio: sí\nTipo de patio: hatchback\nPide otras: no',
        car: sportage,
      }),
    ).toEqual({ stay: true, motivo: 'sigue' });
  });
});
