import {
  detectGearbox,
  formatGearboxAlternatives,
  formatOtherBrandGearboxList,
  gearboxOf,
  pickDiverseByBrand,
  pickGearboxAlternatives,
  resolveGearbox,
  stripGearboxWords,
} from './gearbox';
import { StockCar } from '../catalog/clasificar-filas';
import { TEST_LEXICON } from './test-lexicon';

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
    expect(detectGearbox('Hilux Manuel', TEST_LEXICON)).toBe('manual');
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

  it('si el analizador dice que la caja es de la toma, no filtra patio', () => {
    expect(
      resolveGearbox({
        history: [],
        customerText:
          'Quiero una camioneta usada y vendo cómo parte de pago un nativa año 2011 automático',
        remembered: null,
        cajaCompra: 'no',
      }),
    ).toBeNull();
    expect(
      resolveGearbox({
        history: [
          {
            role: 'user',
            content: 'vendo mi nativa automática',
          },
        ],
        customerText: 'Me gusta la Mitsubishi',
        remembered: null,
        cajaCompra: 'no',
      }),
    ).toBeNull();
    expect(
      resolveGearbox({
        history: [],
        customerText: 'No automático para el campo manual',
        remembered: null,
        cajaCompra: 'manual',
      }),
    ).toBe('manual');
  });

  it('limpia la caja del pedido cuando era de la toma', () => {
    expect(
      stripGearboxWords(
        'Quiero una camioneta usada y vendo un nativa 2011 automático',
      ),
    ).toBe('Quiero una camioneta usada y vendo un nativa 2011');
  });

  it('si cambia de marca lista varias cajas, no manda una sola', () => {
    const hunter: StockCar = {
      id: 'hunter',
      brand: 'great wall',
      model: 'hunter ac 2.4 cd 4x2 tm',
      year: 2023,
      price: 18990,
      typeBody: 'doble cabina',
    };
    const hilux: StockCar = {
      id: 'hilux',
      brand: 'toyota',
      model: 'hilux cd 2.4 4x4 tm',
      year: 2021,
      price: 32990,
      typeBody: 'doble cabina',
    };
    const dmax: StockCar = {
      id: 'dmax',
      brand: 'chevrolet',
      model: 'd-max 4x4 tm',
      year: 2022,
      price: 28990,
      typeBody: 'doble cabina',
    };
    const cars = pickDiverseByBrand([hunter, hilux, dmax], 'manual', 'camioneta');
    expect(cars.map((car) => car.brand)).toEqual([
      'great wall',
      'toyota',
      'chevrolet',
    ]);
    const listed = formatOtherBrandGearboxList({
      gearbox: 'manual',
      askedBrand: 'mitsubishi',
      cars,
      includePrice: false,
    });
    expect(listed.sendId).toBeNull();
    expect(listed.text).toMatch(/no hay manual/i);
    expect(listed.text).toContain('hilux');
    expect(listed.text).toContain('No mandes una sola unidad');
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
