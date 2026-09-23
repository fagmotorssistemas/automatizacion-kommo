import {
  detectBrand,
  detectNamedModelAsk,
  detectTresFilas,
  resolveBrand,
  resolveTresFilas,
} from './vehicle-brand';

describe('marca y tres filas', () => {
  it('Aveo y Chebrolec son Chevrolet', () => {
    expect(detectNamedModelAsk('Aveo')).toEqual({
      brand: 'chevrolet',
      family: 'aveo',
      year: null,
    });
    expect(detectBrand('Chebrolec')).toBe('chevrolet');
  });

  it('Río con tilde es el mismo Kia Rio', () => {
    expect(detectNamedModelAsk('Río ?')).toEqual({
      brand: 'kia',
      family: 'rio',
      year: null,
    });
    expect(detectBrand('Río ?')).toBe('kia');
  });

  it('Sportage manda sobre un Hyundai suelto en el mismo mensaje', () => {
    expect(
      detectBrand(
        'Quiero más información sobre el Kia Sportage 2019\nTiene en Hyundai ix\nSí, por favor',
      ),
    ).toBe('kia');
  });

  it('Hilux sin marca es Toyota y suelta la marca anterior', () => {
    expect(detectBrand('Hilux Manuel')).toBe('toyota');
    expect(
      resolveBrand({
        history: [{ role: 'user', content: 'esa gris' }],
        customerText: 'Hilux Manuel',
        remembered: 'volkswagen',
      }),
    ).toBe('toyota');
  });

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
