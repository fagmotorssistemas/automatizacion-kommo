import {
  askedOutsideListed,
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
  it('detecta el listado numerado', () => {
    expect(looksLikeUnitList(listText)).toBe(true);
    expect(looksLikeUnitList('Tenemos el Sportage 2024 plomo. Aquí las fotos.')).toBe(
      false,
    );
  });

  it('ok y envíeme fotos piden las del listado', () => {
    expect(wantsPhotosOfListed('Si mi estimado ok\nEnvíeme fotos por favor')).toBe(
      true,
    );
    expect(wantsPhotosOfListed('de todas')).toBe(true);
    expect(wantsPhotosOfListed('mándeme')).toBe(true);
    expect(wantsPhotosOfListed('no gracias')).toBe(false);
  });

  it('la roja o la automática dejan una', () => {
    expect(pickListedUnit(sportages, 'la roja', TEST_LEXICON)?.id).toBe('sp-rojo');
    expect(pickListedUnit(sportages, 'la automática', TEST_LEXICON)?.id).toBe(
      'sp-plata',
    );
    expect(pickListedUnit(sportages, 'Envíeme fotos por favor', TEST_LEXICON)).toBeNull();
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
