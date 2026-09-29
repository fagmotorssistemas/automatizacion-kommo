import { fuzzyBrandHits, fuzzyModelHits } from './fuzzy-vehicle-name';
import { TEST_LEXICON } from './test-lexicon';

describe('nombre de vehículo mal escrito', () => {
  it('reconoce marcas del patio aunque vengan mal escritas', () => {
    expect(
      fuzzyBrandHits('El jeptour Blanco 2023', TEST_LEXICON).map(
        (hit) => hit.name,
      ),
    ).toEqual(['jetour']);
    expect(
      fuzzyBrandHits('Chebrolec', TEST_LEXICON).map((hit) => hit.name),
    ).toEqual(['chevrolet']);
  });

  it('reconoce modelos del patio con typo', () => {
    expect(fuzzyModelHits('Hilus Manuel', TEST_LEXICON)[0]).toMatchObject({
      name: 'hilux',
      brand: 'toyota',
    });
    expect(fuzzyModelHits('D-MAX 2014', TEST_LEXICON)[0]).toMatchObject({
      name: 'dmax',
      brand: 'chevrolet',
    });
    expect(fuzzyModelHits('d max 2014', TEST_LEXICON)[0]).toMatchObject({
      name: 'dmax',
      brand: 'chevrolet',
    });
    expect(fuzzyModelHits('Dimax talvez', TEST_LEXICON)[0]).toMatchObject({
      name: 'dmax',
      brand: 'chevrolet',
    });
    expect(
      fuzzyModelHits('Otro carro\nDimax talvez\nO autos', TEST_LEXICON)[0],
    ).toMatchObject({
      name: 'dmax',
      brand: 'chevrolet',
    });
    expect(fuzzyModelHits('di max 2014', TEST_LEXICON)[0]).toMatchObject({
      name: 'dmax',
      brand: 'chevrolet',
    });
    expect(fuzzyModelHits('solo max', TEST_LEXICON)).toEqual([]);
    expect(fuzzyModelHits('avio 2018', TEST_LEXICON)[0]).toMatchObject({
      name: 'aveo',
      brand: 'chevrolet',
    });
  });

  it('reconoce una marca del patio aunque la escriban como suena', () => {
    expect(
      fuzzyBrandHits('que precio el yundad', TEST_LEXICON).map((hit) => hit.name),
    ).toEqual(['hyundai']);
    expect(
      fuzzyBrandHits('video del yunda', TEST_LEXICON).map((hit) => hit.name),
    ).toEqual(['hyundai']);
    expect(fuzzyModelHits('el yundad', TEST_LEXICON)).toEqual([]);
  });

  it('no toma fotos por Foton si Foton no está o la palabra es fotos', () => {
    expect(fuzzyBrandHits('Ayúdeme con fotos', TEST_LEXICON)).toEqual([]);
  });

  it('una palabra corta no es un modelo: «otra» no es Optra', () => {
    expect(fuzzyModelHits('Gracias yo le visito la otra semana', TEST_LEXICON)).toEqual([]);
    expect(fuzzyModelHits('si quiere otra opción', TEST_LEXICON)).toEqual([]);
  });

  it('el modelo escrito bien sigue valiendo', () => {
    expect(fuzzyModelHits('me interesa el optra', TEST_LEXICON).map((hit) => hit.name)).toContain('optra');
  });

  it('3008 no se lee como 2008; 3008n de ficha es 3008', () => {
    const said3008 = fuzzyModelHits(
      'Hola. Me interesa el Peugeot 3008',
      TEST_LEXICON,
    ).map((hit) => hit.name);
    expect(said3008).toContain('3008');
    expect(said3008).not.toContain('2008');
    const said2008 = fuzzyModelHits(
      'Hola. Me interesa el Peugeot 2008',
      TEST_LEXICON,
    ).map((hit) => hit.name);
    expect(said2008).toContain('2008');
    expect(said2008).not.toContain('3008');
    expect(
      fuzzyModelHits('O si tiene un peugeot 208', TEST_LEXICON).map(
        (hit) => hit.name,
      ),
    ).toEqual([]);
  });

});
