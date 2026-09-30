import { armarUnidadesContexto } from './unidades-contexto';

const INTERES = '11111111-1111-4111-8111-111111111111';
const FICHA = '22222222-2222-4222-8222-222222222222';
const LISTA_A = '33333333-3333-4333-8333-333333333333';
const LISTA_B = '44444444-4444-4444-8444-444444444444';
const TOOL = '55555555-5555-4555-8555-555555555555';

describe('armarUnidadesContexto', () => {
  it('registra interested, ficha, lista, alternativas y tool', () => {
    expect(
      armarUnidadesContexto({
        interestedText: 'VEHÍCULO DE INTERÉS',
        interestedId: INTERES,
        sendId: FICHA,
      }),
    ).toEqual([
      { id: INTERES, origen: 'interested' },
      { id: FICHA, origen: 'ficha' },
    ]);

    expect(
      armarUnidadesContexto({
        listedIds: [LISTA_A, LISTA_B],
      }),
    ).toEqual([
      { id: LISTA_A, origen: 'lista' },
      { id: LISTA_B, origen: 'lista' },
    ]);

    expect(
      armarUnidadesContexto({
        contextOrigin: 'alternativas_caja',
        contextIds: [LISTA_A, LISTA_B],
        sendId: LISTA_A,
        toolIds: [TOOL],
      }),
    ).toEqual([
      { id: LISTA_A, origen: 'alternativas_caja' },
      { id: LISTA_B, origen: 'alternativas_caja' },
      { id: TOOL, origen: 'tool' },
    ]);
  });

  it('la misma unidad puede entrar por interested y por tool', () => {
    expect(
      armarUnidadesContexto({
        interestedText: 'ficha',
        interestedId: INTERES,
        toolIds: [INTERES],
      }),
    ).toEqual([
      { id: INTERES, origen: 'interested' },
      { id: INTERES, origen: 'tool' },
    ]);
  });
});
