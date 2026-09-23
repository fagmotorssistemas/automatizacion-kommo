import {
  carsFromMatchJson,
  idsFromMatchJson,
  inventorySearchPlan,
  matchRowsMentionFamily,
} from './inventory-search-plan';

describe('inventory search plan', () => {
  it('si nombra Hilux no filtra por SUV viejo', () => {
    expect(inventorySearchPlan('Hilux Manuel', 'suv', 'volkswagen')).toEqual({
      tipo: null,
      marca: 'toyota',
      named: true,
    });
  });

  it('sin modelo concreto respeta tipo y marca', () => {
    expect(inventorySearchPlan('una camioneta', 'camioneta', null)).toEqual({
      tipo: 'camioneta',
      marca: null,
      named: false,
    });
  });

  it('detecta el modelo en el JSON del embedding', () => {
    expect(
      matchRowsMentionFamily(
        JSON.stringify([{ content: 'toyota hilux cd 2.4 tm', metadata: {} }]),
        'hilux',
      ),
    ).toBe(true);
    expect(matchRowsMentionFamily('[]', 'hilux')).toBe(false);
  });

  it('saca ids del match', () => {
    expect(
      idsFromMatchJson(
        JSON.stringify([{ id: 'a1', metadata: { inventory_id: 'b2' } }]),
      ),
    ).toEqual(['a1']);
  });

  it('arma el carro desde metadata del embedding', () => {
    expect(
      carsFromMatchJson(
        JSON.stringify([
          {
            id: 'sportage-1',
            content: 'kia sportage r gti 2019',
            metadata: {
              brand: 'kia',
              model: 'sportage r gti lx ac 2.0 5p 4x2 ta',
              year: 2019,
              type: 'jeep',
              price: 22900,
              inventory_id: 'sportage-1',
            },
          },
        ]),
      ),
    ).toEqual([
      {
        id: 'sportage-1',
        brand: 'kia',
        model: 'sportage r gti lx ac 2.0 5p 4x2 ta',
        year: 2019,
        price: 22900,
        typeBody: 'jeep',
        color: null,
        plateShort: null,
      },
    ]);
  });
});
