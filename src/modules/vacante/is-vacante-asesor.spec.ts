import { isVacanteAsesorComercial } from './is-vacante-asesor';

describe('isVacanteAsesorComercial', () => {
  it('reconoce el anuncio tal cual', () => {
    expect(
      isVacanteAsesorComercial(
        'Hola. Me interesa el puesto de asesor comercial.',
      ),
    ).toBe(true);
  });

  it('tolera espacios y la falta del punto final', () => {
    expect(
      isVacanteAsesorComercial(
        '  Hola.   Me interesa el puesto de asesor comercial  ',
      ),
    ).toBe(true);
  });

  it('reconoce la frase vacante de asesor comercial', () => {
    expect(
      isVacanteAsesorComercial('Hola, vacante de asesor comercial'),
    ).toBe(true);
  });

  it('un cliente que pide un asesor o un carro sigue en ventas', () => {
    expect(isVacanteAsesorComercial('quiero hablar con un asesor')).toBe(
      false,
    );
    expect(isVacanteAsesorComercial('me interesa el carro')).toBe(false);
    expect(
      isVacanteAsesorComercial('Hola. Me interesa el puesto de vendedor'),
    ).toBe(false);
    expect(isVacanteAsesorComercial('vacante de latonero')).toBe(false);
    expect(isVacanteAsesorComercial('')).toBe(false);
  });
});
