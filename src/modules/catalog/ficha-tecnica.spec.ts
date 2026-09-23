import { factsFromResearch, needsSpecLookup, parseSpecFacts } from './ficha-tecnica';
import { StockCar } from './clasificar-filas';

const x70: StockCar = {
  id: 'x70',
  brand: 'jetour',
  model: 'x70 plus',
  year: 2025,
  price: 22800,
  typeBody: 'jeep',
};

describe('ficha técnica', () => {
  it('investiga filas solo si el patio no trae pasajeros', () => {
    expect(needsSpecLookup('tiene 3 filas', [x70])).toBe(true);
    expect(
      needsSpecLookup('tiene 3 filas', [{ ...x70, passengerCapacity: '7' }]),
    ).toBe(false);
    expect(needsSpecLookup('que tenga techo', [x70])).toBe(true);
    expect(needsSpecLookup('quiero la blanca', [x70])).toBe(false);
  });

  it('una ficha encontrada es hecho y la que no aparece no consta', () => {
    const facts = parseSpecFacts(
      JSON.stringify({
        fichas: [
          { id: 'x70', seguro: true, dato: '7 pasajeros, 3 filas' },
          { id: 't1', seguro: false, dato: 'no consta' },
          { id: 'inventado', seguro: true, dato: '7 pasajeros' },
        ],
      }),
      ['x70', 't1'],
    );
    expect(facts).toEqual([
      { id: 'x70', seguro: true, dato: '7 pasajeros, 3 filas' },
      { id: 't1', seguro: false, dato: 'no consta' },
    ]);
  });

  it('si la búsqueda no responde no se inventa un no consta', () => {
    expect(factsFromResearch(null, ['x70'])).toBeNull();
    expect(factsFromResearch('{"fichas":[]}', ['x70', 't1'])).toBeNull();
    expect(factsFromResearch('no es json', ['x70'])).toBeNull();
    expect(
      factsFromResearch(
        JSON.stringify({
          fichas: [{ id: 'x70', seguro: true, dato: '7 pasajeros, 3 filas' }],
        }),
        ['x70', 't1'],
      ),
    ).toEqual([{ id: 'x70', seguro: true, dato: '7 pasajeros, 3 filas' }]);
  });
});
