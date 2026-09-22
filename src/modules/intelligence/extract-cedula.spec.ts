import { extractCedula } from './extract-cedula';

describe('extractCedula', () => {
  it('lee una cédula de 10 dígitos', () => {
    expect(extractCedula('mi cedula es 0102030405')).toBe('0102030405');
  });

  it('no toma un celular 09', () => {
    expect(extractCedula('llame al 0983335555')).toBeNull();
  });

  it('si hay celular y cédula, se queda con la cédula', () => {
    expect(extractCedula('0983335555 y 1712345678')).toBe('1712345678');
  });
});
