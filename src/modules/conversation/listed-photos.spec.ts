import {
  askedOutsideListed,
  historyHasUnitList,
  lastListedUnits,
  looksLikeUnitList,
  pickListedUnit,
  shortUnitLabel,
  wantsPhotosOfListed,
} from './listed-photos';
import type { StockCar } from '../catalog/clasificar-filas';
import { TEST_LEXICON } from './test-lexicon';

const sportages: StockCar[] = [
  {
    id: 'sp-2024',
    brand: 'kia',
    model: 'sportage ac 2.0',
    year: 2024,
    price: 29200,
    typeBody: 'jeep',
    color: 'plomo',
    transmission: 'manual',
  },
  {
    id: 'sp-negro',
    brand: 'kia',
    model: 'sportage sl ac 2.0',
    year: 2019,
    price: 20000,
    typeBody: 'jeep',
    color: 'negro',
    transmission: 'manual',
  },
  {
    id: 'sp-rojo',
    brand: 'kia',
    model: 'sportage r gti ac 2.0',
    year: 2019,
    price: 21000,
    typeBody: 'jeep',
    color: 'rojo',
    transmission: 'manual',
  },
  {
    id: 'sp-plata',
    brand: 'kia',
    model: 'sportage r gti lx ac 2.0 ta',
    year: 2019,
    price: 21900,
    typeBody: 'jeep',
    color: 'plateado',
    transmission: 'automática',
  },
];

const listText = `Estas son las opciones de Kia Sportage SUV que tenemos: 1) Sportage AC 2.0 5p 4x2 manual, año 2024, color plomo, con 79,187 km, 2) Sportage SL AC 2.0 5p 4x2 manual, año 2019, color negro, con 103,736 km, 3) Sportage R GTI AC 2.0 5p 4x2 manual, año 2019, color rojo, con 91,096 km, 4) Sportage R GTI LX AC 2.0 5p 4x2 automática, año 2019, color plateado, con 113,170 km. ¿Cuál le interesa conocer más a detalle para enviar fotos?`;

describe('listed photos', () => {
  it('sin listado previo no hay cola de fotos', () => {
    expect(historyHasUnitList([])).toBe(false);
    expect(
      historyHasUnitList([
        { role: 'user', content: 'Hola. ¿Puedo obtener más información sobre esto?' },
      ]),
    ).toBe(false);
    expect(
      historyHasUnitList([
        { role: 'assistant', content: 'Con gusto. ¿Qué carro le interesa?' },
      ]),
    ).toBe(false);
    expect(
      historyHasUnitList([{ role: 'assistant', content: listText }]),
    ).toBe(true);
  });

  it('detecta el listado numerado', () => {
    expect(looksLikeUnitList(listText)).toBe(true);
    expect(looksLikeUnitList('Tenemos el Sportage 2024 plomo. Aquí las fotos.')).toBe(
      false,
    );
  });

  it('Sportage 2019: blanco/negro/plateado/rojo cuenta como listado y elige el automático', () => {
    const list =
      'Buenas noches, estimado. Tenemos en patio 4 Kia Sportage 2019 en SUV 4x2: uno blanco manual con kilometraje aún no cargado, negro manual con 103736 km, plateado automático con 113170 km y rojo manual con 91096 km. ¿Cuál le interesa para enviarle más detalles?';
    const patio: StockCar[] = [
      {
        id: 'sp-blanco',
        brand: 'kia',
        model: 'sportage sl ac 2.0',
        year: 2019,
        price: 20000,
        typeBody: 'jeep',
        color: 'blanco',
        transmission: 'manual',
      },
      {
        id: 'sp-negro',
        brand: 'kia',
        model: 'sportage sl ac 2.0',
        year: 2019,
        price: 22200,
        typeBody: 'jeep',
        color: 'negro',
        mileage: 103736,
        transmission: 'manual',
      },
      {
        id: 'sp-plata',
        brand: 'kia',
        model: 'sportage r gti lx ac 2.0 ta',
        year: 2019,
        price: 21500,
        typeBody: 'jeep',
        color: 'plateado',
        mileage: 113170,
        transmission: 'automática',
      },
      {
        id: 'sp-rojo',
        brand: 'kia',
        model: 'sportage r gti ac 2.0',
        year: 2019,
        price: 21000,
        typeBody: 'jeep',
        color: 'rojo',
        mileage: 91096,
        transmission: 'manual',
      },
    ];
    expect(looksLikeUnitList(list)).toBe(true);
    expect(
      lastListedUnits([{ role: 'assistant', content: list }], patio).map(
        (car) => car.id,
      ),
    ).toEqual(['sp-blanco', 'sp-negro', 'sp-plata', 'sp-rojo']);
    expect(pickListedUnit(patio, 'Precio del automático?', TEST_LEXICON)?.id).toBe(
      'sp-plata',
    );
  });

  it('el párrafo de A75330 parte las 4 Sportage y elige el automático', () => {
    const list =
      'Buenas noches, estimado. Tenemos disponible un Kia Sportage SL AC 2.0 5p 4x2 manual blanco del 2019, con kilometraje aún no cargado y También hay un Kia Sportage SL AC 2.0 5p 4x2 manual negro de 2019 con 103,736 km. un Kia Sportage R GTI LX AC 2.0 5p 4x2 automática plateado del 2019 con 113,170 km. y un Kia Sportage R GTI AC 2.0 5p 4x2 manual rojo del 2019 con 91,096 km y ¿Cuál le interesa?';
    const patio: StockCar[] = [
      {
        id: 'sp-blanco',
        brand: 'kia',
        model: 'sportage sl ac 2.0 5p 4x2',
        year: 2019,
        price: 20000,
        typeBody: 'jeep',
        color: 'blanco',
        transmission: 'manual',
      },
      {
        id: 'sp-negro',
        brand: 'kia',
        model: 'sportage sl ac 2.0 5p 4x2',
        year: 2019,
        price: 22200,
        typeBody: 'jeep',
        color: 'negro',
        mileage: 103736,
        transmission: 'manual',
      },
      {
        id: 'sp-plata',
        brand: 'kia',
        model: 'sportage r gti lx ac 2.0 5p 4x2 ta',
        year: 2019,
        price: 21500,
        typeBody: 'jeep',
        color: 'plateado',
        mileage: 113170,
        transmission: 'automática',
      },
      {
        id: 'sp-rojo',
        brand: 'kia',
        model: 'sportage r gti ac 2.0 5p 4x2',
        year: 2019,
        price: 21000,
        typeBody: 'jeep',
        color: 'rojo',
        mileage: 91096,
        transmission: 'manual',
      },
    ];
    const listed = lastListedUnits(
      [{ role: 'assistant', content: list }],
      patio,
    );
    expect(listed.map((car) => car.id)).toEqual([
      'sp-blanco',
      'sp-negro',
      'sp-plata',
      'sp-rojo',
    ]);
    expect(
      pickListedUnit(listed, 'Sportage R GTI automático', TEST_LEXICON)?.id,
    ).toBe('sp-plata');
  });

  it('un párrafo con año y km también es listado', () => {
    const prose =
      'Tenemos estas opciones con motor 2.0 disponibles: Couper AC 1.6 automática blanco 2012 con 60746 km, Tunland G AC 2.0 manual plateado 2023 con 113692 km, Poer AC 2.0 plateado 2022 con 82103 km. ¿Cuál le interesa?';
    expect(looksLikeUnitList(prose)).toBe(true);
    expect(wantsPhotosOfListed('Tiene fotos')).toBe(true);
    const patio: StockCar[] = [
      {
        id: 'couper',
        brand: 'changan',
        model: 'couper ac 1.6',
        year: 2012,
        price: 8000,
        typeBody: 'hatchback',
        color: 'blanco',
        mileage: 60746,
      },
      {
        id: 'tunland',
        brand: 'foton',
        model: 'tunland g ac 2.0',
        year: 2023,
        price: 20000,
        typeBody: 'camioneta',
        color: 'plateado',
        mileage: 113692,
      },
      {
        id: 'poer',
        brand: 'foton',
        model: 'poer ac 2.0',
        year: 2022,
        price: 18000,
        typeBody: 'camioneta',
        color: 'plateado',
        mileage: 82103,
      },
      {
        id: 'otra',
        brand: 'kia',
        model: 'sportage ac 2.0',
        year: 2024,
        price: 29000,
        typeBody: 'jeep',
        color: 'plomo',
        mileage: 10000,
      },
    ];
    expect(
      lastListedUnits([{ role: 'assistant', content: prose }], patio).map(
        (car) => car.id,
      ),
    ).toEqual(['couper', 'tunland', 'poer']);
  });

  it('ok y envíeme fotos piden las del listado', () => {
    expect(wantsPhotosOfListed('Si mi estimado ok\nEnvíeme fotos por favor')).toBe(
      true,
    );
    expect(wantsPhotosOfListed('de todas')).toBe(true);
    expect(wantsPhotosOfListed('mándeme las fotos')).toBe(true);
    expect(wantsPhotosOfListed('Sí, por favor')).toBe(false);
    expect(wantsPhotosOfListed('mándeme')).toBe(false);
    expect(wantsPhotosOfListed('no gracias')).toBe(false);
  });

  it('la roja o la automática dejan una', () => {
    expect(pickListedUnit(sportages, 'la roja', TEST_LEXICON)?.id).toBe('sp-rojo');
    expect(pickListedUnit(sportages, 'la automática', TEST_LEXICON)?.id).toBe(
      'sp-plata',
    );
    expect(pickListedUnit(sportages, 'Envíeme fotos por favor', TEST_LEXICON)).toBeNull();
  });

  it('cabina simple deja la cs del listado de D-Max', () => {
    const dmaxes: StockCar[] = [
      {
        id: 'dmax-2020-cs',
        brand: 'chevrolet',
        model: 'd-max crdi 2.5 cs 4x2 tm diesel',
        year: 2020,
        price: 21900,
        typeBody: 'cabina simple',
        color: 'blanco',
        mileage: 93787,
        transmission: 'manual',
      },
      {
        id: 'dmax-2023-cd',
        brand: 'chevrolet',
        model: 'd-max crdi 2.5 cd 4x2 tm diesel',
        year: 2023,
        price: 28990,
        typeBody: 'doble cabina',
        color: 'plateado',
        mileage: 77613,
        transmission: 'manual',
      },
      {
        id: 'dmax-2022-cd',
        brand: 'chevrolet',
        model: 'd-max crdi 2.5 cd 4x4 tm diesel',
        year: 2022,
        price: 32990,
        typeBody: 'doble cabina',
        color: 'vino',
        mileage: 87687,
        transmission: 'manual',
      },
    ];
    expect(pickListedUnit(dmaxes, 'Cabina simple', TEST_LEXICON)?.id).toBe(
      'dmax-2020-cs',
    );
    expect(
      pickListedUnit(dmaxes, 'Dimax de una sola cabina', TEST_LEXICON, {
        cab: 'cs',
      })?.id,
    ).toBe('dmax-2020-cs');
  });

  it('el enunciado es corto', () => {
    expect(shortUnitLabel(sportages[2])).toBe('Sportage 2019 rojo');
  });

  it('saca las unidades del último listado', () => {
    const listed = lastListedUnits(
      [{ role: 'assistant', content: listText }],
      sportages,
    );
    expect(listed.map((car) => car.id)).toEqual([
      'sp-2024',
      'sp-negro',
      'sp-rojo',
      'sp-plata',
    ]);
  });

  it('no mete otra Sportage del patio que no se nombró', () => {
    const extra: StockCar = {
      id: 'sp-otra',
      brand: 'kia',
      model: 'sportage ex 2.0',
      year: 2021,
      price: 25000,
      typeBody: 'jeep',
      color: 'blanco',
    };
    const listed = lastListedUnits(
      [{ role: 'assistant', content: listText }],
      [...sportages, extra],
    );
    expect(listed.map((car) => car.id)).not.toContain('sp-otra');
    expect(listed).toHaveLength(4);
  });

  it('un Tucson no es del listado de Sportage', () => {
    expect(askedOutsideListed('tucson', sportages)).toBe(true);
    expect(askedOutsideListed('sportage', sportages)).toBe(false);
  });
});
