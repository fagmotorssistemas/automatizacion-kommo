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
});
