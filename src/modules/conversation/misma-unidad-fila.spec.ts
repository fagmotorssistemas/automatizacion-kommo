import { evidenciaReal, mismaUnidadPorFila } from './otro-vehiculo';

describe('mismaUnidadPorFila con tokens cortos', () => {
  it('Mazda 3 no es un Mazda CX-3', () => {
    expect(
      mismaUnidadPorFila('Mazda 3', {
        brand: 'mazda',
        model: 'cx-3',
        year: 2018,
      }),
    ).toBe(false);
  });

  it('3008 es la 3008N', () => {
    expect(
      mismaUnidadPorFila('3008', {
        brand: 'peugeot',
        model: '3008n',
        year: 2022,
      }),
    ).toBe(true);
  });

  it('D-Max es la D-MAX', () => {
    expect(
      mismaUnidadPorFila('D-Max', {
        brand: 'chevrolet',
        model: 'D-MAX',
        year: 2022,
      }),
    ).toBe(true);
  });

  it('solo la marca Kia sigue en el Kia Sportage', () => {
    expect(
      mismaUnidadPorFila('Kia', {
        brand: 'kia',
        model: 'sportage',
        year: 2019,
      }),
    ).toBe(true);
  });

  it('Sportage 2022 es el Sportage 2022', () => {
    expect(
      mismaUnidadPorFila('Sportage 2022', {
        brand: 'kia',
        model: 'sportage lx',
        year: 2022,
      }),
    ).toBe(true);
  });
});

describe('evidenciaReal con los últimos 3 mensajes del bot', () => {
  it('cubre si el nombre está en el penúltimo mensaje del bot', () => {
    expect(
      evidenciaReal('Hilux', 'sí, esa', [
        'Le muestro una Hilux 2024.',
        '¿Le interesa esa?',
      ]),
    ).toBe(true);
  });

  it('no cubre un mensaje del bot más atrás del tercero', () => {
    expect(
      evidenciaReal('Hilux', 'sí, esa', [
        'Le muestro una Hilux 2024.',
        'También hay una D-Max.',
        'Y una Lariat.',
        '¿Cuál le gusta?',
      ]),
    ).toBe(false);
  });
});
