import { describeUnit, type StockCar } from '../catalog/clasificar-filas';
import { formatInterestedCar } from '../conversation/interested-car';
import {
  extraerNumeros,
  hechoDesdeFila,
  validarNumeros,
} from './validar-numeros';

const ROJO_ID = '0fde055a-a72d-4f70-8210-37a404385462';
const ESCAPE_ID = 'b7e1c0aa-1111-4222-8333-444455556666';

const rojo = {
  id: ROJO_ID,
  label: 'kia Sportage 2019 rojo',
  km: 91096,
  precio: 22900,
};

describe('km que no son de la unidad', () => {
  it('a) 15.000 km al año no se modifica', () => {
    const texto = 'recorre mínimo 15.000 km al año';
    expect(extraerNumeros(texto)).toEqual([]);
    expect(validarNumeros(texto, [rojo], ROJO_ID).texto).toBe(texto);
  });

  it('b) garantía de 100.000 km no se modifica', () => {
    const texto = 'garantía de 5 años o 100.000 km';
    expect(extraerNumeros(texto).some((num) => num.tipo === 'km')).toBe(false);
    expect(validarNumeros(texto, [rojo], ROJO_ID).texto).toBe(texto);
  });

  it('c) el km de Toma ficha o Toma ya no se modifica', () => {
    const texto = 'su Ford con 181.280 km';
    const resumen =
      'Interés: Sportage\nToma ficha: Ford Escape 2012\nToma ya: su Ford con 181.280 km\nCaja de compra: no';
    expect(validarNumeros(texto, [rojo], ROJO_ID, { resumen }).texto).toBe(
      texto,
    );
    expect(
      validarNumeros(texto, [rojo], ROJO_ID, {
        resumen: 'Toma ya: Ford Escape km=181280',
      }).texto,
    ).toBe(texto);
  });

  it('d) el km que dijo el cliente no se modifica', () => {
    const texto = 'usted me dijo que tiene 90.000 km';
    expect(
      validarNumeros(texto, [rojo], ROJO_ID, {
        history: [{ role: 'user', content: 'mi carro tiene 90.000 km' }],
      }).texto,
    ).toBe(texto);
    expect(
      validarNumeros(texto, [rojo], ROJO_ID, {
        history: [{ role: 'assistant', content: 'tiene 90.000 km' }],
      }).texto,
    ).toBe('usted me dijo que tiene 91.096 km');
  });

  it('con 33900 km y meta rojo 91096 se sigue corrigiendo', () => {
    expect(validarNumeros('con 33900 km', [rojo], ROJO_ID).texto).toBe(
      'con 91.096 km',
    );
  });

  it('Escape 2012 con mileage 0: se quita "con 0 km" y no se reemplaza', () => {
    const escape = hechoDesdeFila({
      id: ESCAPE_ID,
      brand: 'ford',
      model: 'escape',
      year: 2012,
      color: null,
      mileage: 0,
      price: 9800,
    });
    expect(escape.km).toBeNull();
    const result = validarNumeros('con 0 km', [escape], ESCAPE_ID);
    expect(result.texto).not.toMatch(/con\s+0\s+km/i);
    expect(result.texto).not.toMatch(/\b0\s*km\b/i);
    expect(result.requiereRegenerar).toBe(false);
    expect(result.correcciones).toEqual([
      { tipo: 'km', dijo: 0, correcto: null, id: ESCAPE_ID },
    ]);
  });
});

describe('ficha sin kilometraje', () => {
  const escape: StockCar = {
    id: ESCAPE_ID,
    brand: 'ford',
    model: 'escape',
    year: 2012,
    price: 9800,
    color: 'blanco',
    mileage: 0,
  };

  it('describeUnit con mileage 0 o null dice km=sin dato', () => {
    expect(describeUnit(escape, false)).toContain('km=sin dato');
    expect(describeUnit({ ...escape, mileage: null }, false)).toContain(
      'km=sin dato',
    );
    expect(describeUnit(escape, false)).not.toMatch(/km=0\b/);
  });

  it('formatInterestedCar con mileage 0 o null dice km=sin dato', () => {
    const car = {
      inventoryId: ESCAPE_ID,
      brand: 'ford',
      model: 'escape',
      year: 2012,
      price: 9800,
      mileage: 0 as number | null,
    };
    expect(formatInterestedCar(car)).toContain('km=sin dato');
    expect(formatInterestedCar({ ...car, mileage: null })).toContain(
      'km=sin dato',
    );
  });
});
