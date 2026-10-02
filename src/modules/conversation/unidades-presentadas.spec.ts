import type { StockCar } from '../catalog/clasificar-filas';
import { TEST_LEXICON } from './test-lexicon';
import {
  appendTurnoPresentadas,
  calcularUnidadesPresentadas,
  candidatosDadosAlLlm,
  parseRegistroPresentadas,
  resolverReferenciaPresentadas,
  unidadMencionadaEnTexto,
  unidadesDeFamiliaEnContexto,
} from './unidades-presentadas';

const xtrail2016: StockCar = {
  id: 'xt-2016',
  brand: 'nissan',
  model: 'x-trail ac 2.5',
  year: 2016,
  price: 16890,
  typeBody: 'jeep',
  color: 'azul',
  mileage: 144904,
};

const kicks2020: StockCar = {
  id: 'kicks-2020',
  brand: 'nissan',
  model: 'kicks exclusive',
  year: 2020,
  price: 17900,
  typeBody: 'jeep',
  color: 'blanco',
  mileage: 42000,
};

const exp1998: StockCar = {
  id: 'exp-1998',
  brand: 'ford',
  model: 'explorer xlt 4.0 4x4',
  year: 1998,
  price: 6800,
  typeBody: 'jeep',
  color: 'blanco',
};

const exp2018: StockCar = {
  id: 'exp-2018',
  brand: 'ford',
  model: 'explorer xlt ac 3.5 5p 4x4',
  year: 2018,
  price: 33900,
  typeBody: 'jeep',
  color: 'blanco',
  mileage: 107740,
  transmission: 'automática',
};

const sportagePlata: StockCar = {
  id: 'f690857b-48e8-4ee4-92ff-a89e2d43c622',
  brand: 'kia',
  model: 'sportage r gti lx ac 2.0 5p 4x2 ta',
  year: 2019,
  price: 21900,
  typeBody: 'jeep',
  color: 'plateado',
  mileage: 113170,
  transmission: 'automática',
};

const sportageRoja: StockCar = {
  id: 'sp-rojo',
  brand: 'kia',
  model: 'sportage r gti ac 2.0 5p 4x2',
  year: 2019,
  price: 21000,
  typeBody: 'jeep',
  color: 'rojo',
  mileage: 91096,
  transmission: 'manual',
};

describe('unidadMencionadaEnTexto', () => {
  it('59825503: la prosa nombra X-Trail 2016 y Kicks 2020 sin listado numerado', () => {
    const prose =
      'Tenemos un Nissan X-Trail 2016 y también una Nissan Kicks 2020. ¿Cuál le interesa?';
    expect(unidadMencionadaEnTexto(xtrail2016, prose)).toBe(true);
    expect(unidadMencionadaEnTexto(kicks2020, prose)).toBe(true);
  });

  it('Explorer unidas con "o" no exige parsear la lista', () => {
    const prose =
      'Puedo ofrecerle una Explorer XLT 1998 blanca o una Explorer XLT 2018 blanca.';
    expect(unidadMencionadaEnTexto(exp1998, prose)).toBe(true);
    expect(unidadMencionadaEnTexto(exp2018, prose)).toBe(true);
  });

  it('gemelas Sportage: plateada y roja salen de los datos, no de la viñeta', () => {
    const prose =
      'Tenemos una Sportage plateada automática y una Sportage roja manual.';
    expect(unidadMencionadaEnTexto(sportagePlata, prose)).toBe(true);
    expect(unidadMencionadaEnTexto(sportageRoja, prose)).toBe(true);
  });

  it('sin familia o sin dato propio no cuenta', () => {
    expect(
      unidadMencionadaEnTexto(kicks2020, 'Tenemos un Nissan X-Trail 2016.'),
    ).toBe(false);
    expect(
      unidadMencionadaEnTexto(
        kicks2020,
        'La Kicks es una SUV cómoda. ¿Le mando fotos?',
      ),
    ).toBe(false);
  });
});

describe('calcularUnidadesPresentadas', () => {
  it('deja solo las que el texto final menciona, en ese orden', () => {
    const byId = new Map(
      [xtrail2016, kicks2020, exp2018].map((car) => [car.id, car]),
    );
    const candidatos = candidatosDadosAlLlm({
      listedUnits: [xtrail2016, kicks2020],
      sendId: null,
      toolCars: [exp2018],
      byId,
    });
    const prose =
      'Tenemos un Nissan X-Trail 2016 y también una Nissan Kicks 2020.';
    expect(calcularUnidadesPresentadas(candidatos, prose)).toEqual([
      { inventory_id: 'xt-2016', orden: 1, como: 'lista' },
      { inventory_id: 'kicks-2020', orden: 2, como: 'lista' },
    ]);
  });

  it('una ficha sola queda como ficha', () => {
    const byId = new Map([[xtrail2016.id, xtrail2016]]);
    const candidatos = candidatosDadosAlLlm({
      sendId: xtrail2016.id,
      listedUnits: [xtrail2016],
      byId,
    });
    expect(
      calcularUnidadesPresentadas(
        candidatos,
        'Tenemos disponible un Nissan X-Trail 2016 color azul, con 144904 km.',
      ),
    ).toEqual([{ inventory_id: 'xt-2016', orden: 1, como: 'ficha' }]);
  });

  it('alternativas de fact-miss quedan como alternativa', () => {
    const byId = new Map([
      [exp1998.id, exp1998],
      [exp2018.id, exp2018],
    ]);
    const candidatos = candidatosDadosAlLlm({
      listedUnits: [exp1998, exp2018],
      contextOrigin: 'alternativas_caja',
      contextIds: [exp1998.id, exp2018.id],
      byId,
    });
    expect(
      calcularUnidadesPresentadas(
        candidatos,
        'No hay 2017. Hay una Explorer XLT 1998 blanca o una Explorer XLT 2018 blanca.',
      ),
    ).toEqual([
      { inventory_id: 'exp-1998', orden: 1, como: 'alternativa' },
      { inventory_id: 'exp-2018', orden: 2, como: 'alternativa' },
    ]);
  });
});

describe('registro Redis', () => {
  it('guarda los últimos 3 turnos, el nuevo primero', () => {
    const t1 = [{ inventory_id: 'a', orden: 1, como: 'ficha' as const }];
    const t2 = [
      { inventory_id: 'b', orden: 1, como: 'lista' as const },
      { inventory_id: 'c', orden: 2, como: 'lista' as const },
    ];
    const t3 = [{ inventory_id: 'd', orden: 1, como: 'ficha' as const }];
    const t4 = [{ inventory_id: 'e', orden: 1, como: 'ficha' as const }];
    const stored = appendTurnoPresentadas(
      appendTurnoPresentadas(appendTurnoPresentadas([t1], t2), t3),
      t4,
    );
    expect(stored.map((turno) => turno[0]?.inventory_id)).toEqual([
      'e',
      'd',
      'b',
    ]);
    expect(parseRegistroPresentadas(JSON.stringify(stored))).toEqual(stored);
  });

  it('un turno vacío no pisa el registro', () => {
    const prev = [
      [{ inventory_id: 'a', orden: 1, como: 'ficha' as const }],
    ];
    expect(appendTurnoPresentadas(prev, [])).toEqual(prev);
  });
});

describe('resolverReferenciaPresentadas', () => {
  const byId = new Map(
    [xtrail2016, kicks2020, exp1998, exp2018, sportagePlata, sportageRoja].map(
      (car) => [car.id, car],
    ),
  );

  it('Fotos xfavor tras X-Trail y Kicks deja las dos, no niega', () => {
    const turnos = [
      [
        { inventory_id: xtrail2016.id, orden: 1, como: 'lista' as const },
        { inventory_id: kicks2020.id, orden: 2, como: 'lista' as const },
      ],
    ];
    expect(
      resolverReferenciaPresentadas({
        text: 'Fotos xfavor',
        turnos,
        byId,
        lexicon: TEST_LEXICON,
      }),
    ).toEqual({ kind: 'varias', cars: [xtrail2016, kicks2020] });
  });

  it('La 2018 elige la Explorer 2018 del registro', () => {
    const turnos = [
      [
        { inventory_id: exp1998.id, orden: 1, como: 'lista' as const },
        { inventory_id: exp2018.id, orden: 2, como: 'lista' as const },
      ],
    ];
    expect(
      resolverReferenciaPresentadas({
        text: 'La 2018',
        turnos,
        byId,
        lexicon: TEST_LEXICON,
      }),
    ).toEqual({ kind: 'una', car: exp2018 });
  });

  it('el plateado automático elige la Sportage GTI plateada', () => {
    const turnos = [
      [
        { inventory_id: sportagePlata.id, orden: 1, como: 'lista' as const },
        { inventory_id: sportageRoja.id, orden: 2, como: 'lista' as const },
      ],
    ];
    expect(
      resolverReferenciaPresentadas({
        text: 'el plateado automático',
        turnos,
        byId,
        lexicon: TEST_LEXICON,
      }),
    ).toEqual({ kind: 'una', car: sportagePlata });
  });

  it('la segunda de una lista de 3', () => {
    const turnos = [
      [
        { inventory_id: xtrail2016.id, orden: 1, como: 'lista' as const },
        { inventory_id: kicks2020.id, orden: 2, como: 'lista' as const },
        { inventory_id: exp2018.id, orden: 3, como: 'lista' as const },
      ],
    ];
    expect(
      resolverReferenciaPresentadas({
        text: 'la segunda',
        turnos,
        byId,
        lexicon: TEST_LEXICON,
      }),
    ).toEqual({ kind: 'una', car: kicks2020 });
  });

  it('la misma unidad tras una sola ficha', () => {
    const xtrail2024: StockCar = {
      id: 'xt-2024',
      brand: 'nissan',
      model: 'x-trail e-power exclusive',
      year: 2024,
      price: 32900,
      typeBody: 'jeep',
      color: 'blanco',
      mileage: 21000,
    };
    const turnos = [
      [{ inventory_id: xtrail2024.id, orden: 1, como: 'ficha' as const }],
    ];
    expect(
      resolverReferenciaPresentadas({
        text: 'la misma unidad',
        turnos,
        byId: new Map([[xtrail2024.id, xtrail2024]]),
        lexicon: TEST_LEXICON,
      }),
    ).toEqual({ kind: 'una', car: xtrail2024 });
  });

  it('sin registro no resuelve: el camino viejo sigue', () => {
    expect(
      resolverReferenciaPresentadas({
        text: 'La 2018',
        turnos: [],
        byId,
        lexicon: TEST_LEXICON,
      }),
    ).toEqual({ kind: 'ninguna' });
  });

  it('si la familia está en el registro, no se niega', () => {
    expect(
      unidadesDeFamiliaEnContexto('kicks', [[xtrail2016, kicks2020]]).map(
        (car) => car.id,
      ),
    ).toEqual([kicks2020.id]);
    expect(unidadesDeFamiliaEnContexto('kicks', [[xtrail2016]])).toEqual([]);
  });

  it('un modelo nuevo fuera del registro no se resuelve aquí', () => {
    const turnos = [
      [{ inventory_id: xtrail2016.id, orden: 1, como: 'ficha' as const }],
    ];
    expect(
      resolverReferenciaPresentadas({
        text: 'quiero una Hilux',
        turnos,
        byId,
        lexicon: TEST_LEXICON,
      }),
    ).toEqual({ kind: 'ninguna' });
  });
});
