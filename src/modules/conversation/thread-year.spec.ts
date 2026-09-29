import { resolveThreadYear } from './thread-year';
import { TEST_LEXICON } from './test-lexicon';

function yearOf(prior: string[], current: string, yearSaidNow: number | null) {
  return resolveThreadYear({
    priorUserTexts: prior,
    currentText: current,
    lexicon: TEST_LEXICON,
    yearSaidNow,
  });
}

describe('resolveThreadYear', () => {
  it('Optra solo, sin hilo, no inventa año', () => {
    expect(yearOf([], 'Optra', null)).toEqual({
      year: null,
      onward: false,
      span: null,
    });
  });

  it('Vitara 2015 y luego Optra: el 2015 no se pega', () => {
    expect(
      yearOf(
        ['Hola. Me interesa el Suzuki Grand Vitara 2015'],
        'Optra',
        null,
      ),
    ).toEqual({
      year: null,
      onward: false,
      span: null,
    });
  });

  it('anuncio con año y luego otro modelo: suelta el año', () => {
    expect(
      yearOf(
        ['Hola. Me interesa el Chevrolet Aveo 2015'],
        'Optra',
        null,
      ),
    ).toEqual({
      year: null,
      onward: false,
      span: null,
    });
  });

  it('del 2015 y luego Optra: el año es filtro y sí aplica', () => {
    expect(yearOf(['del 2015'], 'Optra', null)).toEqual({
      year: 2015,
      onward: false,
      span: null,
    });
  });

  it('algo 2015 y luego Optra: sigue el filtro', () => {
    expect(yearOf(['quiero algo 2015'], 'Optra', null)).toEqual({
      year: 2015,
      onward: false,
      span: null,
    });
  });

  it('2015 en adelante y luego Optra: sigue el piso', () => {
    expect(yearOf(['2015 en adelante'], 'Optra', null)).toEqual({
      year: 2015,
      onward: true,
      span: null,
    });
  });

  it('2020 a 2022 y luego Optra: el rango sigue, no un año suelto', () => {
    expect(yearOf(['2020 a 2022'], 'Optra', null)).toEqual({
      year: null,
      onward: false,
      span: { min: 2020, max: 2022 },
    });
  });

  it('rango de otro modelo no se pega al nuevo', () => {
    expect(
      yearOf(['Hola, algún Sportage 2020 a 2022'], 'Optra', null),
    ).toEqual({
      year: null,
      onward: false,
      span: null,
    });
  });

  it('Optra y luego del 2015: ahora sí pide año', () => {
    expect(yearOf(['Optra'], 'del 2015', 2015)).toEqual({
      year: 2015,
      onward: false,
      span: null,
    });
  });

  it('Optra 2015 y luego cuál es el precio: el año sigue', () => {
    expect(yearOf(['Me interesa el Optra 2015'], 'Cuál es el precio', null)).toEqual({
      year: 2015,
      onward: false,
      span: null,
    });
  });

  it('Optra 2015 y luego y automático: sigue en esa unidad', () => {
    expect(yearOf(['Optra 2015'], 'y automático?', null)).toEqual({
      year: 2015,
      onward: false,
      span: null,
    });
  });

  it('este turno manda: Optra 2012 pisa el 2015 del hilo', () => {
    expect(
      yearOf(
        ['Hola. Me interesa el Suzuki Grand Vitara 2015'],
        'Optra 2012',
        2012,
      ),
    ).toEqual({
      year: 2012,
      onward: false,
      span: null,
    });
  });

  it('Vitara 2015 y luego mejor 2012: reemplaza el año', () => {
    expect(
      yearOf(
        ['Hola. Me interesa el Suzuki Grand Vitara 2015'],
        'mejor 2012',
        2012,
      ),
    ).toEqual({
      year: 2012,
      onward: false,
      span: null,
    });
  });

  it('el año que dijo el bot no cuenta (solo textos del cliente)', () => {
    expect(yearOf([], 'Prado', null)).toEqual({
      year: null,
      onward: false,
      span: null,
    });
  });

  it('mismo modelo otra vez sin año: conserva el año de esa línea', () => {
    expect(
      yearOf(['Me interesa el Optra 2015', 'y fotos'], 'el Optra', null),
    ).toEqual({
      year: 2015,
      onward: false,
      span: null,
    });
  });
});
