import { StockCar } from './clasificar-filas';
import {
  carsForReview,
  formatComplianceForAgent,
  parseComplianceReview,
  vehicleToSend,
} from './revisar-cumplimiento';

const cars: StockCar[] = [
  {
    id: 'sentra',
    brand: 'nissan',
    model: 'sentra exclusive ac 1.8 4p 4x2 ta',
    year: 2014,
    price: 13800,
    typeBody: 'sedan',
    vin: 'VIN-SENTRA',
    passengerCapacity: null,
  },
  {
    id: 'xtrail',
    brand: 'nissan',
    model: 'x-trail sense cvt ac 2.5 5p 4x2 ta',
    year: 2016,
    price: 16890,
    typeBody: 'jeep',
    transmission: 'automática',
  },
  {
    id: 'epower',
    brand: 'nissan',
    model: 'x-trail epower exclusive ac 5p',
    year: 2024,
    price: 38990,
    typeBody: 'jeep',
  },
];

describe('revisión de cumplimiento', () => {
  it('arma la ficha con chasis y omite los campos vacíos', () => {
    const payload = carsForReview(cars);
    expect(payload[0]).toMatchObject({
      id: 'sentra',
      marca: 'nissan',
      chasis: 'VIN-SENTRA',
    });
    expect(payload[0]).not.toHaveProperty('pasajeros');
    expect(payload[0]).toMatchObject({
      puertas: 4,
      transmision: 'automática',
      traccion: '4x2',
    });
    expect(payload[1]).toMatchObject({ transmision: 'automática' });
  });

  it('si el patio mandó 4p en transmission, va a puertas y no a caja', () => {
    const payload = carsForReview([
      {
        id: 'golf-p8',
        brand: 'volkswagen',
        model: 'golf comfortline 4p',
        year: 2005,
        price: 9800,
        typeBody: 'hatchback',
        transmission: '4p',
        plateShort: 'P8',
      },
    ]);
    expect(payload[0]).toMatchObject({ puertas: 4 });
    expect(payload[0]).not.toHaveProperty('transmision');
  });

  it('ignora ids que no están en el patio y el resto queda como no cumple', () => {
    const review = parseComplianceReview(
      'texto {"cumplen":["xtrail","inventado"],"no_cumplen":[]}',
      ['sentra', 'xtrail', 'epower'],
    );
    expect(review).toEqual({
      cumplen: ['xtrail'],
      parecidos: [],
      noCumplen: ['sentra', 'epower'],
    });
  });

  it('guarda los parecidos y no repite un id que ya cumple', () => {
    expect(
      parseComplianceReview(
        '{"cumplen":[],"parecidos":["xtrail","xtrail","inventado","epower","sentra"]}',
        ['sentra', 'xtrail', 'epower'],
      ),
    ).toEqual({
      cumplen: [],
      parecidos: ['xtrail', 'epower', 'sentra'],
      noCumplen: [],
    });
  });

  it('acepta que ninguno cumpla', () => {
    expect(
      parseComplianceReview('{"cumplen":[]}', ['sentra', 'xtrail']),
    ).toEqual({
      cumplen: [],
      parecidos: [],
      noCumplen: ['sentra', 'xtrail'],
    });
  });

  it('rechaza una respuesta que no es la revisión', () => {
    expect(parseComplianceReview('no sé', ['sentra'])).toBeNull();
    expect(parseComplianceReview('{"no_cumplen":["sentra"]}', ['sentra'])).toBeNull();
  });

  it('con un solo cumplimiento manda ese carro', () => {
    const review = {
      cumplen: ['xtrail'],
      parecidos: [],
      noCumplen: ['sentra', 'epower'],
    };
    const text = formatComplianceForAgent('7 pasajeros', cars, review);
    expect(text).toContain('REVISIÓN DEL PEDIDO: 7 pasajeros');
    expect(text).toContain('inventory_id=xtrail');
    expect(text).toContain('exactamente "xtrail"');
    expect(text).toContain('Sentra');
    expect(vehicleToSend(review, null)).toBe('xtrail');
  });

  it('con varios que cumplen no manda fotos hasta que elija', () => {
    const review = {
      cumplen: ['xtrail', 'epower'],
      parecidos: [],
      noCumplen: ['sentra'],
    };
    const text = formatComplianceForAgent('7 pasajeros', cars, review);
    expect(text).toContain('vehiculo null');
    expect(text).toContain('X-Trail 2016');
    expect(text).toContain('X-Trail 2024');
    expect(text).not.toContain('$');
    expect(vehicleToSend(review, null)).toBeNull();
    expect(vehicleToSend(review, 'epower')).toBe('epower');
    expect(vehicleToSend(review, 'sentra')).toBeNull();
  });

  it('si ninguno cumple manda el más parecido de la misma marca', () => {
    const review = {
      cumplen: [],
      parecidos: ['xtrail'],
      noCumplen: ['sentra', 'epower'],
    };
    const text = formatComplianceForAgent('7 pasajeros', cars, review);
    expect(text).toMatch(/lo más parecido/i);
    expect(text).toContain('inventory_id=xtrail');
    expect(text).toContain('No pases a otra marca');
    expect(vehicleToSend(review, null)).toBe('xtrail');
  });

  it('si ninguno cumple exacto ofrece cercanos de la misma marca, no otra marca', () => {
    const review = {
      cumplen: [],
      parecidos: [],
      noCumplen: ['sentra', 'xtrail', 'epower'],
    };
    const text = formatComplianceForAgent('7 pasajeros', cars, review);
    expect(text).toContain('Ofrece lo más cercano de ESTA misma marca');
    expect(text).toContain('No pases a otra marca');
    expect(vehicleToSend(review, null)).toBeNull();
  });
});
