import {
  clasificarFilas,
  formatRevisionMarca,
  textMentionsModel,
  userNamedModel,
} from './clasificar-filas';
import type { StockCar } from './clasificar-filas';

const nissans: StockCar[] = [
  {
    id: 'sentra',
    brand: 'nissan',
    model: 'sentra exclusive ac 1.8 4p 4x2 ta',
    year: 2014,
    price: 13800,
    typeBody: 'sedan',
  },
  {
    id: 'kicks',
    brand: 'nissan',
    model: 'kicks advance cvt ac 1.6 5p 4x2 ta',
    year: 2020,
    price: 18900,
    typeBody: 'jeep',
  },
  {
    id: 'frontier',
    brand: 'nissan',
    model: 'frontier s ac 2.5 cd 4x2 tm',
    year: 2021,
    price: 26590,
    typeBody: 'doble cabina',
  },
  {
    id: 'xtrail',
    brand: 'nissan',
    model: 'x-trail sense cvt ac 2.5 5p 4x2 ta',
    year: 2016,
    price: 16890,
    typeBody: 'jeep',
  },
];

describe('clasificar filas', () => {
  it('el sentra y la frontier no son de tres filas; la x-trail sí puede', () => {
    expect(clasificarFilas(nissans[0].model, nissans[0].typeBody)).toBe('no');
    expect(clasificarFilas(nissans[1].model, nissans[1].typeBody)).toBe('no');
    expect(clasificarFilas(nissans[2].model, nissans[2].typeBody)).toBe('no');
    expect(clasificarFilas(nissans[3].model, nissans[3].typeBody)).toBe(
      'posible',
    );
  });

  it('7pas en el nombre sí es tres filas', () => {
    expect(
      clasificarFilas('santa fe dm 7pas ac 2.4 5p 4x2', 'jeep'),
    ).toBe('tres_filas');
  });

  it('nissan solo no nombra un modelo', () => {
    expect(textMentionsModel('Nissan', nissans[0].model)).toBe(false);
    expect(userNamedModel(['Nissan'], nissans)).toBe(false);
    expect(userNamedModel(['quiero la x trail'], nissans)).toBe(true);
  });

  it('la revisión lista las líneas y ofrece la x-trail sin cerrar', () => {
    const text = formatRevisionMarca({
      marca: 'nissan',
      cars: nissans,
      tresFilas: true,
      soloMarca: true,
    });
    expect(text).toContain('Sentra, Kicks, Frontier, X-Trail');
    expect(text).toContain('X-Trail 2016');
    expect(text).not.toContain('$');
    expect(text).toContain('No ofrezcas otra marca');
    expect(text).toContain('vehiculo null');
  });
});
