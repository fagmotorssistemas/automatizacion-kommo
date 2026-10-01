import {
  FRASE_PLACA_PENDIENTE,
  filtrarCamposInternos,
  fraseDePlaca,
  lexicalizarPlaca,
  medirPlacaNoCoincide,
  etiquetaPlacaFicha,
  preguntaProvinciaPlaca,
} from './placa-provincia';

describe('placa-provincia', () => {
  it('fraseDePlaca de P5 nombra Pichincha y el 5', () => {
    expect(fraseDePlaca('P5')).toBe(
      'La placa empieza con P (matriculado por primera vez en Pichincha) y termina en 5.',
    );
  });

  it('letra fuera de la tabla ANT no inventa provincia', () => {
    expect(fraseDePlaca('D5')).toBe(
      'La placa empieza con D y termina en 5.',
    );
  });

  it('sin plate_short no hay frase', () => {
    expect(fraseDePlaca(null)).toBeNull();
    expect(fraseDePlaca('')).toBeNull();
  });

  it('la ficha trae matrícula y nunca plate_short', () => {
    expect(etiquetaPlacaFicha('P5')).toBe(
      'placa={{placa}} (matrícula: Pichincha)',
    );
    expect(etiquetaPlacaFicha('P5')).not.toMatch(/plate_short/);
    expect(etiquetaPlacaFicha(null)).toMatch(/sin placa/i);
    expect(etiquetaPlacaFicha(null)).not.toMatch(/plate_short/);
  });

  it('lexicaliza {{placa}} o deja pendiente', () => {
    expect(lexicalizarPlaca('{{placa}}', 'P5')).toBe(
      'La placa empieza con P (matriculado por primera vez en Pichincha) y termina en 5.',
    );
    expect(lexicalizarPlaca('{{placa}}', null)).toBe(FRASE_PLACA_PENDIENTE);
    expect(lexicalizarPlaca('listo {{otro}}', 'P5')).not.toContain('{{');
  });

  it('quita plate_short. y marca campoFiltrado', () => {
    const out = filtrarCamposInternos('transmisión automática. plate_short.');
    expect(out.mensaje).not.toMatch(/plate_short/i);
    expect(out.mensaje).toMatch(/transmisión automática/i);
    expect(out.campoFiltrado).toBe(true);
  });

  it('el LLM que inventa B y 3 queda registrado', () => {
    expect(
      medirPlacaNoCoincide('empieza con B y termina en 3', 'P5'),
    ).toEqual({ dijo: 'B3', correcto: 'P5' });
    expect(
      medirPlacaNoCoincide(
        'La placa empieza con P (matriculado por primera vez en Pichincha) y termina en 5.',
        'P5',
      ),
    ).toBeNull();
  });

  it('Pichincha o Bolívar es pregunta de provincia de placa', () => {
    expect(preguntaProvinciaPlaca('¿Pichincha o Bolívar amigo?')).toBe(true);
    expect(preguntaProvinciaPlaca('¿Qué placa es el carro?')).toBe(false);
  });
});
