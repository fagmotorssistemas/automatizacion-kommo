import {
  detectGearbox,
  formatGearboxAlternatives,
  gearboxOf,
  pickGearboxAlternatives,
  resolveGearbox,
} from './gearbox';
import { StockCar } from '../catalog/clasificar-filas';

const picanto: StockCar = {
  id: 'picanto',
  brand: 'kia',
  model: 'picanto lx ac 1.2 4p 4x2 ta',
  year: 2023,
  price: 15990,
  typeBody: 'sedan',
};

const fiat: StockCar = {
  id: 'fiat500',
  brand: 'fiat',
  model: '500 lounge ac 1.4 3p 4x2 tm',
  year: 2017,
  price: 13990,
  typeBody: 'hatckback',
};

const sportage: StockCar = {
  id: 'sportage',
  brand: 'kia',
  model: 'sportage sl ac 2.0 5p 4x2 tm',
  year: 2019,
  price: 22200,
  typeBody: 'jeep',
};

describe('caja', () => {
  it('lee manual del mensaje y ta/tm del modelo', () => {
    expect(detectGearbox('Y en manual no dispone')).toBe('manual');
    expect(detectGearbox('Hilux Manuel')).toBe('manual');
    expect(detectGearbox('Hola soy Manuel')).toBeNull();
    expect(detectGearbox('lo quiero automático')).toBe('automatica');
    expect(gearboxOf(picanto)).toBe('automatica');
    expect(gearboxOf(fiat)).toBe('manual');
    expect(gearboxOf(sportage)).toBe('manual');
  });

  it('el manual dicho queda vigente', () => {
    expect(
      resolveGearbox({
        history: [{ role: 'user', content: 'Y en manual no dispone' }],
        customerText: 'Con la jep porfavor',
        remembered: null,
      }),
    ).toBe('manual');
  });

  it('si no hay ese modelo manual, ofrece otro chico de precio parecido', () => {
    const pick = pickGearboxAlternatives({
      cars: [picanto, fiat, sportage],
      gearbox: 'manual',
      family: 'picanto',
      group: 'chico',
      referencePrice: 15990,
    });
    expect(pick).toEqual({ cars: [fiat], widenedToSuv: false, sameModel: false });
    const text = formatGearboxAlternatives({
      gearbox: 'manual',
      pick: pick as NonNullable<typeof pick>,
      includePrice: false,
    });
    expect(text.sendId).toBe('fiat500');
    expect(text.text).toContain('Prohibido ofrecer la caja automática');
    expect(text.text).not.toContain('picanto');
  });

  it('sin sedán ni hatchback manual, pasa a un SUV', () => {
    const nearSuv: StockCar = { ...sportage, price: 17000 };
    const pick = pickGearboxAlternatives({
      cars: [picanto, nearSuv],
      gearbox: 'manual',
      family: 'picanto',
      group: 'chico',
      referencePrice: 15990,
    });
    expect(pick?.widenedToSuv).toBe(true);
    expect(pick?.cars.map((car) => car.id)).toEqual(['sportage']);
  });
});
