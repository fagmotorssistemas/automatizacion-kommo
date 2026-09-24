import {
  detectBrand,
  detectColorInText,
  detectNamedModelAsk,
  detectTrimInText,
  detectTresFilas,
  detectYearInText,
  resolveBrand,
  resolveTresFilas,
} from './vehicle-brand';
import { TEST_LEXICON } from './test-lexicon';

describe('marca y tres filas', () => {
  it('Chevrolet Grand Vitara no se trata como Suzuki', () => {
    expect(
      detectNamedModelAsk(
        'me interesa su auto Chevrolet Grand Vitara 3P Sport 2008',
        TEST_LEXICON,
      ),
    ).toEqual({
      brand: 'chevrolet',
      family: 'vitara',
      year: 2008,
    });
    expect(
      detectBrand(
        'me interesa su auto Chevrolet Grand Vitara 3P Sport 2008',
        TEST_LEXICON,
      ),
    ).toBe('chevrolet');
    expect(detectNamedModelAsk('Grand Vitara 2008', TEST_LEXICON)).toEqual({
      brand: '',
      family: 'vitara',
      year: 2008,
    });
    expect(detectNamedModelAsk('Me interesa el Peugeot 2008', TEST_LEXICON)).toEqual({
      brand: 'peugeot',
      family: '2008',
      year: null,
    });
    expect(
      detectNamedModelAsk('Peugeot 2008 2022', TEST_LEXICON),
    ).toEqual({
      brand: 'peugeot',
      family: '2008',
      year: 2022,
    });
  });

  it('premiere 2020 se lee como versión y año', () => {
    expect(detectYearInText('estoy buscando la premiere 2020')).toBe(2020);
    expect(detectTrimInText('estoy buscando la premiere 2020')).toBe(
      'premier',
    );
  });

  it('marca o modelo mal escrito se reconoce igual', () => {
    expect(detectBrand('El jeptour Blanco 2023', TEST_LEXICON)).toBe('jetour');
    expect(detectBrand('Chebrolec', TEST_LEXICON)).toBe('chevrolet');
    expect(detectBrand('Hilus Manuel', TEST_LEXICON)).toBe('toyota');
    expect(detectBrand('Ayúdeme con fotos', TEST_LEXICON)).toBeNull();
    expect(detectBrand('Buenas tarde que precio el yundad', TEST_LEXICON)).toBe(
      'hyundai',
    );
    expect(detectBrand('Al fin video del yunda', TEST_LEXICON)).toBe('hyundai');
    expect(detectNamedModelAsk('el yundad', TEST_LEXICON)).toBeNull();
    expect(detectYearInText('El jeptour Blanco 2023')).toBe(2023);
    expect(detectYearInText('Cliente da 2000 de entrada a 6 años')).toBeNull();
    expect(detectYearInText('Vitara 2008')).toBe(2008);
    expect(
      detectNamedModelAsk('Tiene el hyundai y 10', TEST_LEXICON),
    ).toEqual({ brand: 'hyundai', family: 'i10', year: null });
    expect(
      detectNamedModelAsk('Tiene el hyuidai y 10', TEST_LEXICON),
    ).toEqual({ brand: 'hyundai', family: 'i10', year: null });
    expect(
      detectNamedModelAsk('tiene el hyundai gran i 10', TEST_LEXICON),
    ).toEqual({ brand: 'hyundai', family: 'i10', year: null });
    expect(detectYearInText('Chevrolet D-max CRDI 2023q')).toBe(2023);
    expect(
      detectNamedModelAsk(
        'Hola. Me interesa el Chevrolet D-max CRDI 2023q',
        TEST_LEXICON,
      ),
    ).toEqual({ brand: 'chevrolet', family: 'dmax', year: 2023 });
    expect(detectColorInText('El jeptour Blanco 2023')).toBe('blanco');
  });

  it('D-MAX del patio se lee aunque venga partido', () => {
    expect(detectNamedModelAsk('Una D-MAX del 2014', TEST_LEXICON)).toEqual({
      brand: 'chevrolet',
      family: 'dmax',
      year: 2014,
    });
    expect(detectBrand('¿Una D-MAX del 2015 o 2014?', TEST_LEXICON)).toBe(
      'chevrolet',
    );
  });

  it('Aveo y Chebrolec son Chevrolet', () => {
    expect(detectNamedModelAsk('Aveo', TEST_LEXICON)).toEqual({
      brand: 'chevrolet',
      family: 'aveo',
      year: null,
    });
    expect(detectBrand('Chebrolec', TEST_LEXICON)).toBe('chevrolet');
  });

  it('Río con tilde es el mismo Kia Rio', () => {
    expect(
      detectNamedModelAsk(
        'Toyota Hilux cabina doble a gasolina, 4x2 año 2023 en adelante',
        TEST_LEXICON,
      ),
    ).toEqual({
      brand: 'toyota',
      family: 'hilux',
      year: 2023,
    });
    expect(detectNamedModelAsk('Río ?', TEST_LEXICON)).toEqual({
      brand: 'kia',
      family: 'rio',
      year: null,
    });
    expect(detectBrand('Río ?', TEST_LEXICON)).toBe('kia');
  });

  it('un modelo fuera de patio gana si va después de la marca', () => {
    expect(
      detectNamedModelAsk(
        'Si el picanto es muy pequeño el Kia sonet me interesa del año 2021\nO 2022',
        TEST_LEXICON,
      ),
    ).toEqual({ brand: 'kia', family: 'sonet', year: 2022 });
    expect(
      detectNamedModelAsk(
        'Cliente quiere información sobre un Kia Sonet año 2021 o 2022.',
        TEST_LEXICON,
      ),
    ).toEqual({ brand: 'kia', family: 'sonet', year: 2022 });
    expect(detectNamedModelAsk('El Kia me interesa', TEST_LEXICON)).toBeNull();
    expect(
      detectNamedModelAsk('el Jetour tiene 3 filas?', TEST_LEXICON),
    ).toBeNull();
    expect(detectNamedModelAsk('Nissan automático', TEST_LEXICON)).toBeNull();
    expect(
      detectNamedModelAsk('Nisan\nPrecio por favor', TEST_LEXICON),
    ).toBeNull();
    expect(
      detectNamedModelAsk('El jeptour Blanco 2023', TEST_LEXICON),
    ).toBeNull();
    expect(detectBrand('el Jetour tiene 3 filas?', TEST_LEXICON)).toBe(
      'jetour',
    );
    expect(detectBrand('El jeptour Blanco 2023', TEST_LEXICON)).toBe('jetour');
  });

  it('Sportage manda sobre un Hyundai suelto en el mismo mensaje', () => {
    expect(
      detectBrand(
        'Quiero más información sobre el Kia Sportage 2019\nTiene en Hyundai ix\nSí, por favor',
        TEST_LEXICON,
      ),
    ).toBe('kia');
  });

  it('Hilux sin marca es Toyota y suelta la marca anterior', () => {
    expect(detectBrand('Hilux Manuel', TEST_LEXICON)).toBe('toyota');
    expect(
      resolveBrand({
        history: [{ role: 'user', content: 'esa gris' }],
        customerText: 'Hilux Manuel',
        remembered: 'volkswagen',
        lexicon: TEST_LEXICON,
      }),
    ).toBe('toyota');
  });

  it('detecta nissan y se queda con la última marca del mensaje', () => {
    expect(detectBrand('Nissan', TEST_LEXICON)).toBe('nissan');
    expect(
      detectBrand('no quiero hyundai, yo necesito un Nissan', TEST_LEXICON),
    ).toBe('nissan');
  });

  it('mantiene la marca cuando el mensaje nuevo no la repite', () => {
    expect(
      resolveBrand({
        history: [{ role: 'user', content: 'Nissan' }],
        customerText: 'Yo quiero uno de tres filas de 7 pasajeros',
        remembered: null,
        lexicon: TEST_LEXICON,
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
        lexicon: TEST_LEXICON,
      }),
    ).toBe('nissan');
  });

  it('detecta tres filas y 7 pasajeros', () => {
    expect(detectTresFilas('uno de tres filas de 7 pasajeros')).toBe(true);
    expect(detectTresFilas('cuánto cuesta')).toBe(false);
  });

  it('4x4 es tracción, no el T1 ni otro modelo', () => {
    expect(detectNamedModelAsk('No era 4x4?', TEST_LEXICON)).toBeNull();
    expect(detectNamedModelAsk('Precio\nNo era 4x4?', TEST_LEXICON)).toBeNull();
    expect(detectNamedModelAsk('Jetour T1', TEST_LEXICON)).toEqual({
      brand: 'jetour',
      family: 't1',
      year: null,
    });
    expect(
      detectNamedModelAsk('Tienen D-max 4x4?', TEST_LEXICON),
    ).toEqual({
      brand: 'chevrolet',
      family: 'dmax',
      year: null,
    });
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
