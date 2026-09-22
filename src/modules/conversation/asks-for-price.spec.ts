import { asksForPrice } from './asks-for-price';

describe('asksForPrice', () => {
  it('detecta cuando pide el valor', () => {
    expect(asksForPrice('el precio x favor')).toBe(true);
    expect(asksForPrice('¿Cuánto cuesta la X-Trail?')).toBe(true);
    expect(asksForPrice('a cómo está la hilux')).toBe(true);
  });

  it('no dispara por pedir el carro o el financiamiento', () => {
    expect(asksForPrice('me interesa una hilux')).toBe(false);
    expect(asksForPrice('tiene fotos de la ranger')).toBe(false);
    expect(asksForPrice('háganme la simulación a 36 meses')).toBe(false);
  });
});
