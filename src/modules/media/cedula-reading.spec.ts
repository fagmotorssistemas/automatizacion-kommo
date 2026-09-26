import { formatCedulaPhotoText, parseCedulaReading } from './cedula-reading';

describe('parseCedulaReading', () => {
  it('arma el texto con número, nombre y origen', () => {
    const raw =
      '{"numero":"1712 345678","nombre":"JUAN PEREZ","origen":"QUITO"}';
    expect(parseCedulaReading(raw)).toEqual({
      numero: '1712345678',
      nombre: 'JUAN PEREZ',
      origen: 'QUITO',
    });
    expect(formatCedulaPhotoText(raw)).toBe(
      'Envió foto de su cédula.\nNúmero: 1712345678\nNombre: JUAN PEREZ\nOrigen: QUITO',
    );
  });

  it('no inventa un número si no se lee', () => {
    expect(
      parseCedulaReading('{"numero":null,"nombre":"JUAN","origen":null}'),
    ).toBeNull();
    expect(formatCedulaPhotoText('{"marca":"toyota"}')).toBeNull();
  });

  it('descarta un celular y un campo vacío', () => {
    expect(
      parseCedulaReading(
        '{"numero":"0983335555","nombre":"null","origen":"no legible"}',
      ),
    ).toBeNull();
  });
});
