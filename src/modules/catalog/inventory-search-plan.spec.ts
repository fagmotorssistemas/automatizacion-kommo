import {
  carsFromMatchJson,
  idsFromMatchJson,
  inventorySearchPlan,
  matchRowsMentionFamily,
} from './inventory-search-plan';
import { TEST_LEXICON } from '../conversation/test-lexicon';

describe('inventory search plan', () => {
  it('Chevrolet Grand Vitara busca Chevrolet, no Suzuki', () => {
    expect(
      inventorySearchPlan(
        'Chevrolet Grand Vitara 3P Sport 2008',
        'suv',
        'suzuki',
        TEST_LEXICON,
      ),
    ).toEqual({
      tipo: null,
      marca: 'chevrolet',
      named: true,
    });
  });

  it('Vitara sin marca no se clava en Suzuki', () => {
    expect(
      inventorySearchPlan('Grand Vitara 2008', 'suv', 'suzuki', TEST_LEXICON),
    ).toEqual({
      tipo: null,
      marca: null,
      named: true,
    });
  });

  it('si nombra Hilux no filtra por SUV viejo', () => {
    expect(
      inventorySearchPlan('Hilux Manuel', 'suv', 'volkswagen', TEST_LEXICON),
    ).toEqual({
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
