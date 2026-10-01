import { TEST_LEXICON } from './test-lexicon';
import {
  carsMatchingRejectLabel,
  excludeRejected,
  mergeRejected,
  restoreNamedFamily,
} from './rejected-cars';

const vitaraA = {
  id: 'd38ea60d',
  brand: 'suzuki',
  model: 'grand vitara sz next',
  year: 2015,
  price: 13800,
  typeBody: 'jeep',
};
const vitaraB = {
  id: 'e4f2046f',
  brand: 'suzuki',
  model: 'grand vitara 2.0',
  year: 2014,
  price: 12500,
  typeBody: 'jeep',
};
const jac = {
  id: 'jac-s5',
  brand: 'jac',
  model: 's5 2.0',
  year: 2018,
  price: 14990,
  typeBody: 'jeep',
};

describe('memoria de rechazos', () => {
  it('Grand Vitara matchea las dos unidades de patio', () => {
    expect(
      carsMatchingRejectLabel('Grand Vitara', [vitaraA, vitaraB, jac], TEST_LEXICON).map(
        (car) => car.id,
      ),
    ).toEqual(['d38ea60d', 'e4f2046f']);
  });

  it('excludeRejected quita ids y la familia', () => {
    expect(
      excludeRejected([vitaraA, vitaraB, jac], {
        ids: ['d38ea60d'],
        families: ['vitara'],
      }).map((car) => car.id),
    ).toEqual(['jac-s5']);
  });

  it('si el cliente vuelve a nombrar la familia, se restaura', () => {
    const rejected = mergeRejected(
      { ids: [], families: [] },
      { ids: ['d38ea60d', 'e4f2046f'], families: ['vitara'] },
    );
    expect(
      restoreNamedFamily(rejected, 'vitara', [vitaraA, vitaraB, jac]),
    ).toEqual({ ids: [], families: [] });
  });
});
