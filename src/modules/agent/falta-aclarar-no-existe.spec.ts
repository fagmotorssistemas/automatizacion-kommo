import { respuestaAclaraAnioNoExiste } from './falta-aclarar-no-existe';

describe('respuestaAclaraAnioNoExiste', () => {
  it('detecta el año pedido junto a no tenemos', () => {
    expect(
      respuestaAclaraAnioNoExiste(
        'No tenemos el 4Runner 2010, pero tenemos uno 2004',
        2010,
      ),
    ).toBe(true);
  });

  it('no marca si solo ofrece el otro año', () => {
    expect(
      respuestaAclaraAnioNoExiste('Tenemos un 4Runner 2004 color rojo.', 2010),
    ).toBe(false);
  });
});
