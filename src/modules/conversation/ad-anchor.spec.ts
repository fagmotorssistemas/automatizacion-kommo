import {
  askedMileageKm,
  carsNearMileage,
  pickFeaturedAdUnits,
} from './ad-anchor';

describe('ancla de anuncio y km', () => {
  const explorer = {
    id: '479b66bd',
    brand: 'ford',
    model: 'explorer xlt',
    year: 2018,
    price: 24990,
    typeBody: 'jeep',
    mileage: 62000,
  };
  const yuan = {
    id: 'yuan-1',
    brand: 'byd',
    model: 'yuan plus',
    year: 2024,
    price: 21990,
    typeBody: 'jeep',
    mileage: 25199,
  };
  const golf = {
    id: 'golf',
    brand: 'volkswagen',
    model: 'golf',
    year: 2005,
    price: 9800,
    typeBody: 'sedan',
    mileage: 140000,
  };
  const qq3 = {
    id: 'qq3',
    brand: 'chery',
    model: 'qq3',
    year: 2012,
    price: 5800,
    typeBody: 'hatchback',
    mileage: 80000,
  };

  it('elige 3 tipos distintos', () => {
    expect(
      pickFeaturedAdUnits([explorer, yuan, golf, qq3], 3).map((car) => car.id),
    ).toEqual(['479b66bd', 'golf', 'qq3']);
  });

  it('25000km calza el Yuan 25199', () => {
    expect(askedMileageKm('el auto que tiene 25000km')).toBe(25000);
    expect(
      carsNearMileage([explorer, yuan, golf], 25000).map((car) => car.id),
    ).toEqual(['yuan-1']);
  });
});
