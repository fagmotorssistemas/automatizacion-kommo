import { coincidenUnidad, hechosDesdeTexto, precioDicho } from './coinciden-unidad';
import { TEST_LEXICON } from '../conversation/test-lexicon';
import type { StockCar } from './clasificar-filas';

const jetours: StockCar[] = [
  {
    id: '2023',
    brand: 'jetour',
    model: 'x70 ii ac 1.5 5p 4x2 tm',
    year: 2023,
    price: 17990,
    color: 'blanco',
    typeBody: 'jeep',
  },
  {
    id: '22800',
    brand: 'jetour',
    model: 'x70 plus ii ac 1.5 4x2 tm',
    year: 2025,
    price: 22800,
    color: 'plateado',
    typeBody: 'jeep',
  },
  {
    id: '21600',
    brand: 'jetour',
    model: 'x70 plus 6dct ac 1.5 5p 4x2 ta',
    year: 2025,
    price: 21600,
    color: 'plateado',
    typeBody: 'jeep',
  },
];

describe('unidad que más coincide', () => {
  it('22,800 y 2025 ganan al blanco', () => {
    const text = 'el de 22,800, que es 2025, me dice el blanco';
    expect(precioDicho(text)).toBe(22800);
    const hechos = hechosDesdeTexto(text, 2025, TEST_LEXICON);
    const hit = coincidenUnidad(jetours, hechos);
    expect(hit?.cars.map((car) => car.id)).toEqual(['22800']);
    expect(hit?.distinto).toContain('color');
    expect(hit?.distinto).not.toContain('año');
    expect(hit?.distinto).not.toContain('precio');
  });

  it('un solo dato no arma este camino', () => {
    const hechos = hechosDesdeTexto('el 2025', 2025, TEST_LEXICON);
    expect(coincidenUnidad(jetours, hechos)).toBeNull();
  });
});
