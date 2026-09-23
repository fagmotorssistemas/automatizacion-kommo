import {
  asksForLargePassengerSpace,
  isLargePassengerCar,
  parsePassengerAsk,
  pickLargePassengerCars,
} from './large-passenger';
import type { StockCar } from '../catalog/clasificar-filas';

describe('large passenger', () => {
  it('furgoneta o 17-20 pasajeros es pedido de espacio', () => {
    expect(
      asksForLargePassengerSpace(
        'Por favor páseme los modelos de vehículos y furgonetas de 17 o 20 pasajeros',
      ),
    ).toBe(true);
    expect(parsePassengerAsk('furgonetas de 17 o 20 pasajeros')).toBe(20);
    expect(asksForLargePassengerSpace('cuánto cuesta el Picanto')).toBe(false);
  });

  it('no cuenta un Picanto ni una camioneta como carro grande de pasajeros', () => {
    expect(
      isLargePassengerCar({
        model: 'picanto lx ac 1.2',
        typeBody: 'hatchback',
        passengerCapacity: 5,
      }),
    ).toBe(false);
    expect(
      isLargePassengerCar({
        model: 'hilux cd 2.4 4x4',
        typeBody: 'doble cabina',
        passengerCapacity: 5,
      }),
    ).toBe(false);
    expect(
      isLargePassengerCar({
        model: 'sportage r gti',
        typeBody: 'jeep',
        passengerCapacity: 5,
      }),
    ).toBe(true);
  });

  it('al armar alternativas deja fuera chicos y pickups', () => {
    const cars: StockCar[] = [
      {
        id: 'picanto',
        brand: 'kia',
        model: 'picanto lx',
        year: 2023,
        price: 15990,
        typeBody: 'hatchback',
      },
      {
        id: 'hilux',
        brand: 'toyota',
        model: 'hilux cd',
        year: 2022,
        price: 32900,
        typeBody: 'doble cabina',
      },
      {
        id: 'sportage',
        brand: 'kia',
        model: 'sportage r',
        year: 2019,
        price: 22900,
        typeBody: 'jeep',
        passengerCapacity: '5',
      },
    ];
    const picked = pickLargePassengerCars(cars);
    expect(picked.map((car) => car.id)).toEqual(['sportage']);
  });
});
