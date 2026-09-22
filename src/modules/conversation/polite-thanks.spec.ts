import { isPoliteThanks } from './polite-thanks';

describe('gracias no es despedida', () => {
  it('un gracias después de la atención sigue siendo la venta', () => {
    expect(
      isPoliteThanks('Muchas gracias por su atención y comunicación.'),
    ).toBe(true);
  });

  it('un rechazo sí cierra', () => {
    expect(isPoliteThanks('no gracias, ya no me interesa')).toBe(false);
    expect(isPoliteThanks('ya compré en otro lado')).toBe(false);
  });
});
