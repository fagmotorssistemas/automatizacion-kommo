import {
  followsShownCar,
  formatInterestedCar,
  historyPresentedFicha,
  leftShownCar,
  refersToInterestedCar,
} from './interested-car';
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
          'SOLICITUD ACTUAL:\nCliente quiere información sobre un Kia Sonet año 2021 o 2022.',
        car: patioKia,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(true);
    expect(
      followsShownCar({
        text: 'Si el picanto es muy pequeño el Kia sonet me interesa del año 2021\nO 2022',
        car: patioKia,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(false);
  });

  it('se suelta si el mensaje o el resumen piden otro carro', () => {
    expect(
      followsShownCar({ text: 'Hilux', car: sportage, lexicon: TEST_LEXICON }),
    ).toBe(false);
    expect(
      leftShownCar({ text: 'Hilux', car: sportage, lexicon: TEST_LEXICON }),
    ).toBe(true);
    expect(
      leftShownCar({
        text: 'Tiene el hyundai y 10',
        car: sportage,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(true);
    expect(
      leftShownCar({
        text: 'Dispongo de 10.000$',
        car: { ...sportage, price: 22900 },
      }),
    ).toBe(true);
    expect(
      leftShownCar({
        text: 'Qué vehículo tiene por 10.000$',
        car: { ...sportage, price: 22900 },
      }),
    ).toBe(true);
    expect(
      followsShownCar({
        text: 'sí, esa',
        resumen: 'SOLICITUD ACTUAL:\nCliente quiere ver una Hilux.',
        car: sportage,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(false);
    expect(
      leftShownCar({
        text: 'Q otras tienen porfabor',
        resumen:
          'SOLICITUD ACTUAL:\nCliente quiere otras camionetas similares.\nPide otras: sí',
        car: sportage,
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
      refersToInterestedCar('Gran vitara 3 puertas', explorer, TEST_LEXICON),
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
          'RESUMEN PREVIO:\nVehículo: Toyota 4 runner 4x2 t/a 2004\nSOLICITUD ACTUAL:\nCliente quiere saber el precio del Toyota 4runner mostrado y confirmar la tracción 4x2 vs 4x4.\nPide otras: no\nTiene duda: sí',
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

  it('otro año o otra caja no es la misma unidad', () => {
    expect(
      followsShownCar({
        text: 'el Sportage 2014 más barato',
        car: sportage,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(false);
    expect(followsShownCar({ text: 'y en manual?', car: sportage })).toBe(
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
        car: dmax2022,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(false);
    expect(
      followsShownCar({
        text: 'sí',
        resumen:
          'RESUMEN PREVIO:\nVehículo: D-Max 2022 vino\nSOLICITUD ACTUAL:\nCliente busca la Premiere 2020.',
        car: dmax2022,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(false);
    expect(followsShownCar({ text: 'cuántos km tiene?', car: dmax2022 })).toBe(
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
    expect(formatInterestedCar(explorer)).not.toContain('$33990');
    expect(formatInterestedCar(explorer)).toContain('precio_interno=33990');
    expect(formatInterestedCar(explorer, true)).toContain('$33990');
    expect(formatInterestedCar(explorer)).toMatch(/si pidió otro año/i);
  });

  it('el km está para responderlo si lo pide, no para soltar la placa', () => {
    const text = formatInterestedCar({
      ...sportage,
      mileage: 144904,
      plateShort: 'L5',
    });
    expect(text).toContain('km=144904');
    expect(text).toMatch(/km vs año/i);
    expect(text).toContain('plate_short=L5');
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

  it('si ya se dio la ficha el precio va justificado, no se vuelve a listar', () => {
    const text = formatInterestedCar(
      { ...explorer, mileage: 113692, color: 'plateado', transmission: 'manual' },
      true,
      { slimAfterFicha: true, skipMileageCare: true },
    );
    expect(text).toMatch(/ficha YA se presentó/i);
    expect(text).toContain('$33990');
    expect(text).toContain('km=113692');
    expect(text).toMatch(/justifica el valor/i);
    expect(text).not.toContain('color=plateado');
    expect(text).not.toContain('caja=manual');
    expect(text).not.toMatch(/AL CLIENTE:.*mecánico/i);
    expect(
      formatInterestedCar(explorer, false, {
        slimAfterFicha: true,
        creditFollowUp: true,
      }),
    ).toMatch(/Pregunta con cuánto de entrada y a qué plazo/i);
  });

  it('si pide furgoneta suelta el carro chico', () => {
    expect(
      leftShownCar({
        text: 'Por favor páseme furgonetas de 17 o 20 pasajeros',
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
});
