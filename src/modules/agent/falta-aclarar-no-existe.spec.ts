import { respuestaAclaraAnioNoExiste, respuestaAclaraNoExiste } from './falta-aclarar-no-existe';

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

  it('detecta caja o color junto a no tenemos', () => {
    expect(
      respuestaAclaraNoExiste(
        'No tenemos el Picanto con manual; el que hay es automático.',
        'manual',
      ),
    ).toBe(true);
    expect(
      respuestaAclaraNoExiste('El Picanto es blanco.', 'rojo'),
    ).toBe(false);
  });
});
