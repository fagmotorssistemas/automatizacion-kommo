import {
  sanitizeInventedResumenFlags,
  textAsksForHours,
  textAsksForLocation,
} from './sanitize-resumen-flags';

describe('sanitizeInventedResumenFlags', () => {
  const inventado = [
    'SOLICITUD ACTUAL:',
    'Cliente quiere más información, la ubicación y el horario.',
    'Pide ubicación: sí',
    'Pide horario: sí',
    'Falta vehículo: sí',
  ].join('\n');

  it('quiero más información no es ubicación ni horario', () => {
    expect(textAsksForLocation('¡Hola! Quiero más información')).toBe(false);
    expect(textAsksForHours('¡Hola! Quiero más información')).toBe(false);
    const out = sanitizeInventedResumenFlags(
      inventado,
      '¡Hola! Quiero más información',
    );
    expect(out).toMatch(/Pide ubicación: no/i);
    expect(out).toMatch(/Pide horario: no/i);
    expect(out).not.toMatch(/Pide ubicación: sí/i);
    expect(out).not.toMatch(/Pide horario: sí/i);
  });

  it('más información sobre esto tampoco inventa casa', () => {
    const out = sanitizeInventedResumenFlags(
      inventado,
      'Hola. ¿Puedo obtener más información sobre esto?',
    );
    expect(out).toMatch(/Pide ubicación: no/i);
    expect(out).toMatch(/Pide horario: no/i);
  });

  it('si pidió dirección, la bandera se queda', () => {
    expect(
      textAsksForLocation(
        '¡Hola! Quiero más información dirección x favor gracias',
      ),
    ).toBe(true);
    const out = sanitizeInventedResumenFlags(
      inventado,
      '¡Hola! Quiero más información dirección x favor gracias',
    );
    expect(out).toMatch(/Pide ubicación: sí/i);
    expect(out).toMatch(/Pide horario: no/i);
  });

  it('si preguntó si atienden, el horario se queda', () => {
    expect(textAsksForHours('atienden hoy?')).toBe(true);
    const out = sanitizeInventedResumenFlags(
      inventado,
      'atienden hoy?',
    );
    expect(out).toMatch(/Pide horario: sí/i);
    expect(out).toMatch(/Pide ubicación: no/i);
  });

  it('dónde están ubicados sí es ubicación', () => {
    expect(
      textAsksForLocation('Hermoso el precio en donde estan ubicados'),
    ).toBe(true);
  });
});
