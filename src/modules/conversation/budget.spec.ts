import {
  carsInBudget,
  detectCashBudget,
  formatBudgetRevision,
} from './budget';
import type { StockCar } from '../catalog/clasificar-filas';

const patio: StockCar[] = [
  {
    id: 'kona-1',
    brand: 'hyundai',
    model: 'kona gls',
    year: 2022,
    price: 21990,
    typeBody: 'jeep',
  },
  {
    id: 'xtrail-1',
    brand: 'nissan',
    model: 'x-trail sense cvt',
    year: 2016,
    price: 16890,
    typeBody: 'jeep',
  },
  {
    id: 'rio-1',
    brand: 'kia',
    model: 'rio lx',
    year: 2018,
    price: 9800,
    typeBody: 'sedan',
  },
  {
    id: 'picanto-1',
    brand: 'kia',
    model: 'picanto lx',
    year: 2017,
    price: 8900,
    typeBody: 'hatchback',
  },
];

describe('presupuesto de contado', () => {
  it('dispongo de 10.000$ es tope, no entrada', () => {
    expect(detectCashBudget('Dispongo de 10.000$')).toBe(10000);
    expect(detectCashBudget('Qué vehículo tiene por 10.000$')).toBe(10000);
    expect(detectCashBudget('2 mil de entrada')).toBeNull();
    expect(detectCashBudget('Para 6 años')).toBeNull();
  });

  it('en 10000 no entra el Kona ni el X-Trail', () => {
    const hits = carsInBudget(patio, 10000, 'xtrail-1');
    expect(hits.map((car) => car.id).sort()).toEqual(['picanto-1', 'rio-1']);
    expect(hits.some((car) => car.id === 'kona-1')).toBe(false);
  });

  it('el pedido lista las que caben y no arma cuota', () => {
    const text = formatBudgetRevision({
      budget: 10000,
      cars: carsInBudget(patio, 10000, 'xtrail-1'),
      over: { family: 'xtrail', price: 16890 },
    });
    expect(text.text).toMatch(/PRESUPUESTO DE CONTADO: \$10000/);
    expect(text.text).toMatch(/picanto|rio/i);
    expect(text.text).not.toMatch(/kona/i);
    expect(text.text).toMatch(/no pidió crédito/i);
    expect(text.sendId).toBeNull();
  });
});
