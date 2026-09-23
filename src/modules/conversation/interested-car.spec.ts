import {
  followsShownCar,
  formatInterestedCar,
  leftShownCar,
  refersToInterestedCar,
} from './interested-car';

const explorer = {
  inventoryId: 'exp-1',
  brand: 'ford',
  model: 'explorer xlt ac 3.5 5p 4x4',
  year: 2018,
  price: 33990,
};

const sportage = {
  inventoryId: 'plata-1',
  brand: 'kia',
  model: 'sportage r gti 2019 ta',
  year: 2019,
  price: 22900,
  typeBody: 'jeep',
};

describe('vehículo de interés', () => {
  it('el hilo sigue aunque no use este/precio/automático', () => {
    expect(
      followsShownCar({
        text: 'tiene cámara de reversa?',
        resumen:
          'RESUMEN PREVIO:\nVehículo: Kia Sportage 2019 plateado\nSOLICITUD ACTUAL:\nCliente quiere saber si tiene cámara.',
        history: [
          { role: 'assistant', content: 'Le mandé las fotos del Sportage plateado.' },
        ],
        car: sportage,
      }),
    ).toBe(true);
    expect(followsShownCar({ text: 'puedo ir el sábado?', car: sportage })).toBe(
      true,
    );
    expect(followsShownCar({ text: 'ok', car: sportage })).toBe(true);
    expect(followsShownCar({ text: 'Me interesa', car: sportage })).toBe(true);
    expect(
      followsShownCar({
        text: 'Cual es el precio d este automático',
        car: sportage,
      }),
    ).toBe(true);
  });

  it('se suelta si el mensaje o el resumen piden otro carro', () => {
    expect(followsShownCar({ text: 'Hilux', car: sportage })).toBe(false);
    expect(leftShownCar({ text: 'Hilux', car: sportage })).toBe(true);
    expect(
      followsShownCar({
        text: 'sí, esa',
        resumen: 'SOLICITUD ACTUAL:\nCliente quiere ver una Hilux.',
        car: sportage,
      }),
    ).toBe(false);
    expect(
      refersToInterestedCar('Gran vitara 3 puertas', explorer),
    ).toBe(false);
  });

  it('otro año o otra caja no es la misma unidad', () => {
    expect(
      followsShownCar({ text: 'el Sportage 2014 más barato', car: sportage }),
    ).toBe(false);
    expect(followsShownCar({ text: 'y en manual?', car: sportage })).toBe(
      false,
    );
  });

  it('la simulación sigue con el Explorer', () => {
    expect(
      refersToInterestedCar(
        'Me puede hacer la simulación 60 % entrada y a 36 meses',
        explorer,
      ),
    ).toBe(true);
    expect(refersToInterestedCar('Este vehiculo', explorer)).toBe(true);
    expect(refersToInterestedCar('el precio x favor', explorer)).toBe(true);
  });

  it('el precio queda interno hasta que el cliente lo pida', () => {
    expect(formatInterestedCar(explorer)).not.toContain('$33990');
    expect(formatInterestedCar(explorer)).toContain('precio_interno=33990');
    expect(formatInterestedCar(explorer, true)).toContain('$33990');
    expect(formatInterestedCar(explorer)).toContain('No reabras inventario');
  });

  it('el km está para responderlo si lo pide, no para soltar la placa', () => {
    const text = formatInterestedCar({
      ...sportage,
      mileage: 144904,
      plateShort: 'L5',
    });
    expect(text).toContain('km=144904');
    expect(text).toContain('plate_short=L5');
    expect(text).toMatch(/si el resumen o el mensaje los piden/i);
    expect(text).not.toMatch(/La placa es/i);
  });
});
