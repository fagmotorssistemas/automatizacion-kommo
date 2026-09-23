import {
  cedulaFromThread,
  extractCedula,
  replyAsksForCedula,
} from './extract-cedula';

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

  it('lee la cédula de este mensaje o del hilo', () => {
    expect(extractCedula('mi numero de cedula es 1102986013')).toBe(
      '1102986013',
    );
    expect(
      cedulaFromThread('ok', [
        { role: 'user', content: 'mi numero de cedula es 1102986013' },
      ]),
    ).toBe('1102986013');
  });

  it('detecta si la respuesta vuelve a pedir la cédula', () => {
    expect(
      replyAsksForCedula(
        'Por favor, páseme su número de cédula para que un asesor revise si califica.',
      ),
    ).toBe(true);
    expect(
      replyAsksForCedula(
        'Recibí su cédula. Un asesor revisa si califica.',
      ),
    ).toBe(false);
  });
});
