import { etapaFromFlags } from './etapa-from-flags';

describe('etapaFromFlags', () => {
  it('sin mensaje propio queda en 0', () => {
    expect(
      etapaFromFlags({
        propios: 0,
        precioMostrado: false,
        cuotaMostrada: false,
      }),
    ).toBe(0);
  });

  it('un mensaje propio es 1; precio sin conversar no sube', () => {
    expect(
      etapaFromFlags({
        propios: 1,
        precioMostrado: true,
        cuotaMostrada: false,
      }),
    ).toBe(1);
  });

  it('cuota sin precio salta a 4', () => {
    expect(
      etapaFromFlags({
        propios: 2,
        precioMostrado: false,
        cuotaMostrada: true,
      }),
    ).toBe(4);
  });

  it('precio sin cuota queda en 3', () => {
    expect(
      etapaFromFlags({
        propios: 2,
        precioMostrado: true,
        cuotaMostrada: false,
      }),
    ).toBe(3);
  });

  it('visita de patio salta a 6', () => {
    expect(
      etapaFromFlags({
        propios: 2,
        precioMostrado: false,
        cuotaMostrada: false,
        visito: true,
      }),
    ).toBe(6);
  });
});
