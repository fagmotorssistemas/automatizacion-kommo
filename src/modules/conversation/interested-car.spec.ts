import {
  formatInterestedCar,
  refersToInterestedCar,
} from './interested-car';

const explorer = {
  inventoryId: 'exp-1',
  brand: 'ford',
  model: 'explorer xlt ac 3.5 5p 4x4',
  year: 2018,
  price: 33990,
};

describe('vehículo de interés', () => {
  it('la simulación y "este vehículo" siguen con el Explorer', () => {
    expect(
      refersToInterestedCar(
        'Me puede hacer la simulación 60 % entrada y a 36 meses',
        explorer,
      ),
    ).toBe(true);
    expect(refersToInterestedCar('Este vehiculo', explorer)).toBe(true);
  });

  it('un modelo nuevo no usa el Explorer', () => {
    expect(refersToInterestedCar('Gran vitara 3 puertas', explorer)).toBe(
      false,
    );
  });

  it('el texto trae el precio para no volver a pedirlo', () => {
    expect(formatInterestedCar(explorer)).toContain('$33990');
    expect(formatInterestedCar(explorer)).toContain('No vuelvas a pedir');
  });
});
