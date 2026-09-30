import { TEST_LEXICON } from './test-lexicon';
import {
  patioFamiliesCacheFresh,
  rememberPatioFamilies,
  resetPatioFamiliesCache,
  sospechaOtroVehiculo,
} from './otro-vehiculo';
import type { StockCar } from '../catalog/clasificar-filas';

const sportage = { brand: 'kia', model: 'sportage r gti' };

const santaFe: StockCar = {
  id: 'santa-1',
  brand: 'hyundai',
  model: 'santa fe dm 7pas ac 2.4 5p 4x2',
  year: 2018,
  price: 18900,
  typeBody: 'jeep',
};

const tucson: StockCar = {
  id: 'tucson-1',
  brand: 'hyundai',
  model: 'tucson gl',
  year: 2020,
  price: 19900,
  typeBody: 'jeep',
};

describe('sospechaOtroVehiculo', () => {
  beforeEach(() => {
    resetPatioFamiliesCache();
  });

  it('Santa Fe con Sportage mostrada marca sospecha (marca distinta)', () => {
    expect(
      sospechaOtroVehiculo('tienes Santa Fe?', sportage, [santaFe], TEST_LEXICON),
    ).toBeTruthy();
  });

  it('Tucson en patio con Sportage mostrada marca el modelo', () => {
    const hit = sospechaOtroVehiculo(
      'y el Tucson?',
      sportage,
      [tucson],
      TEST_LEXICON,
    );
    expect(hit).toBeTruthy();
    expect(String(hit).toLowerCase()).toMatch(/tucson|hyundai/);
  });

  it('pregunta de km no marca sospecha', () => {
    expect(
      sospechaOtroVehiculo('cuánto es el km?', sportage, [santaFe, tucson], TEST_LEXICON),
    ).toBeNull();
  });

  it('toma de un Chevrolet Aveo marca la marca', () => {
    expect(
      sospechaOtroVehiculo(
        'mi carro es un Chevrolet Aveo',
        sportage,
        [santaFe],
        TEST_LEXICON,
      ),
    ).toMatch(/chevrolet/i);
  });

  it('la Sportage no marca sospecha: excluye tokens de la mostrada', () => {
    expect(
      sospechaOtroVehiculo('la Sportage', sportage, [santaFe, tucson], TEST_LEXICON),
    ).toBeNull();
  });

  it('pedido Mazda 3 en el mensaje con CX-3 mostrada marca sospecha', () => {
    const cx3 = { brand: 'mazda', model: 'cx-3', year: 2018 };
    expect(
      sospechaOtroVehiculo(
        'No amigo un Mazda 3 busco',
        cx3,
        [],
        TEST_LEXICON,
        'Mazda 3',
      ),
    ).toBe('Mazda 3');
  });

  it('pedido Mazda 3 sin nombrarlo en el mensaje no marca sospecha', () => {
    const cx3 = { brand: 'mazda', model: 'cx-3', year: 2018 };
    expect(
      sospechaOtroVehiculo(
        'cuánto cuesta esa?',
        cx3,
        [],
        TEST_LEXICON,
        'Mazda 3',
      ),
    ).toBeNull();
  });

  it('cachea familias del patio y no exige volver a pasar filas', () => {
    rememberPatioFamilies([tucson]);
    expect(patioFamiliesCacheFresh()).toBe(true);
    const hit = sospechaOtroVehiculo('y el Tucson?', sportage, [], TEST_LEXICON);
    expect(String(hit).toLowerCase()).toMatch(/tucson|hyundai/);
  });
});
