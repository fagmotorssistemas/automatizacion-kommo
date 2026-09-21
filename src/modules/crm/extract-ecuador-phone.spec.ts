import { extractEcuadorPhone } from './extract-ecuador-phone';

describe('extractEcuadorPhone', () => {
  it('normaliza 09xxxxxxxx a +593', () => {
    expect(extractEcuadorPhone('escríbeme al 0987654321 porfa')).toBe(
      '+593987654321',
    );
  });

  it('acepta +593 con espacio o guion de país', () => {
    expect(extractEcuadorPhone('mi número es +593 987654321')).toBe(
      '+593987654321',
    );
    expect(extractEcuadorPhone('llámame +593-987654321')).toBe('+593987654321');
  });

  it('acepta 9 dígitos sin 0', () => {
    expect(extractEcuadorPhone('987654321')).toBe('+593987654321');
  });

  it('devuelve null si no hay celular', () => {
    expect(extractEcuadorPhone('Hola, me interesa un Vitara')).toBeNull();
    expect(extractEcuadorPhone('')).toBeNull();
  });
});
