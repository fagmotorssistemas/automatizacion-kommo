import {
  asksForLargePassengerSpace,
  isLargePassengerCar,
  parsePassengerAsk,
  pickCarsWithMinSeats,
  pickLargePassengerCars,
  seatsFromDato,
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

  it('7 plazas no mete pickup ni un SUV de 5', () => {
    expect(seatsFromDato('7 pasajeros, 3 filas')).toBe(7);
    const picked = pickCarsWithMinSeats(
      [
        {
          id: 'dmax',
          brand: 'chevrolet',
          model: 'd-max crdi 2.5 cd 4x4',
          year: 2022,
          price: 26900,
          typeBody: 'doble cabina',
          passengerCapacity: '5',
        },
        {
          id: 'sportage',
          brand: 'kia',
          model: 'sportage ac 2.0',
          year: 2024,
          price: 22900,
          typeBody: 'jeep',
          passengerCapacity: '5',
        },
        {
          id: 'explorer',
          brand: 'ford',
          model: 'explorer limited',
          year: 2018,
          price: 28900,
          typeBody: 'jeep',
          passengerCapacity: '7',
        },
      ],
      7,
    );
    expect(picked.map((car) => car.id)).toEqual(['explorer']);
  });
});
