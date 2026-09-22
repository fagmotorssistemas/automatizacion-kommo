import { detectBrand, detectTresFilas, resolveBrand, resolveTresFilas } from './vehicle-brand';

describe('marca y tres filas', () => {
  it('detecta nissan y se queda con la última marca del mensaje', () => {
    expect(detectBrand('Nissan')).toBe('nissan');
    expect(detectBrand('no quiero hyundai, yo necesito un Nissan')).toBe(
      'nissan',
    );
  });

  it('mantiene la marca cuando el mensaje nuevo no la repite', () => {
    expect(
      resolveBrand({
        history: [{ role: 'user', content: 'Nissan' }],
        customerText: 'Yo quiero uno de tres filas de 7 pasajeros',
        remembered: null,
      }),
    ).toBe('nissan');
  });

  it('no deja que el bot cambie la marca', () => {
    expect(
      resolveBrand({
        history: [
          { role: 'user', content: 'Nissan' },
          { role: 'assistant', content: 'Tenemos un Hyundai Santa Fe' },
        ],
        customerText: 'No muchas gracias yo necesito un Nissan',
        remembered: 'nissan',
      }),
    ).toBe('nissan');
  });

  it('detecta tres filas y 7 pasajeros', () => {
    expect(detectTresFilas('uno de tres filas de 7 pasajeros')).toBe(true);
    expect(detectTresFilas('cuánto cuesta')).toBe(false);
  });

  it('recuerda que pidió tres filas', () => {
    expect(
      resolveTresFilas({
        history: [],
        customerText: 'ok el precio',
        remembered: true,
      }),
    ).toBe(true);
  });
});
