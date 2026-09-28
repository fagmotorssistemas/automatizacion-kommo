import { detectVacanteEtiqueta } from './detect-vacante';
import { isVacanteDesarrollador } from './is-vacante-desarrollador';

describe('isVacanteDesarrollador', () => {
  it('reconoce el anuncio tal cual, con o sin punto final y espacios', () => {
    expect(
      isVacanteDesarrollador(
        'Hola. Me interesa el puesto de Desarrollador de Software.',
      ),
    ).toBe(true);
    expect(
      isVacanteDesarrollador(
        '  Hola.   Me interesa el puesto de Desarrollador de Software  ',
      ),
    ).toBe(true);
  });

  it('reconoce la frase vacante de desarrollador de software', () => {
    expect(
      isVacanteDesarrollador('Hola, vacante de desarrollador de software'),
    ).toBe(true);
  });

  it('un cliente de carros no es una vacante', () => {
    expect(isVacanteDesarrollador('me interesa el carro')).toBe(false);
    expect(isVacanteDesarrollador('')).toBe(false);
  });
});

describe('detectVacanteEtiqueta', () => {
  it('cada anuncio trae su etiqueta; el resto del camino es el mismo', () => {
    expect(
      detectVacanteEtiqueta('Hola. Me interesa el puesto de asesor comercial.'),
    ).toBe('vacante_asesor_comercial');
    expect(
      detectVacanteEtiqueta('Hola. Me interesa el puesto de Desarrollador de Software'),
    ).toBe('vacante_desarrollador');
  });

  it('un mensaje de ventas no es vacante', () => {
    expect(detectVacanteEtiqueta('Hola. Me interesa el Suzuki Grand Vitara 2015')).toBeNull();
    expect(detectVacanteEtiqueta('vacante de latonero')).toBeNull();
  });
});
