import {
  otrasDiferidas,
  sanitizeInventedResumenFlags,
  textAsksForHours,
  textAsksForLocation,
  textAsksForSeats,
  textAsksForTresFilas,
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

  it('dónde la puedo revisar es ubicación', () => {
    expect(
      textAsksForLocation('Valor de la camioneta\nDonde la puedo revisar'),
    ).toBe(true);
  });

  it('sí por favor no inventa 7 plazas ni 3 filas', () => {
    expect(textAsksForSeats('Sí, por favor')).toBeNull();
    expect(textAsksForTresFilas('Sí, por favor')).toBe(false);
    expect(textAsksForSeats('Montero Sport GLS AC 3.0 5p 4x4')).toBeNull();
    const out = sanitizeInventedResumenFlags(
      [
        'SOLICITUD ACTUAL:',
        'Cliente quiere más información del Montero 5p.',
        'Asientos: 7',
        'Tres filas: sí',
      ].join('\n'),
      'Sí, por favor',
    );
    expect(out).toMatch(/Asientos: no/i);
    expect(out).toMatch(/Tres filas: no/i);
    expect(out).not.toMatch(/Asientos: 7/i);
  });

  it('si pidió 7 asientos la bandera se queda y el 5p no manda', () => {
    expect(textAsksForSeats('tiene 7 asientos?')).toBe(7);
    const out = sanitizeInventedResumenFlags(
      'SOLICITUD ACTUAL:\nValidar.\nAsientos: 5\nTres filas: sí',
      'tiene 7 asientos?',
    );
    expect(out).toMatch(/Asientos: 7/i);
    expect(out).toMatch(/Tres filas: no/i);
  });

  it('si el bot preguntó horario y el turno solo acepta, el horario se queda', () => {
    const last =
      '¿Le gustaría que le informe sobre nuestros horarios para cuando planifique su visita?';
    const inventado = [
      'SOLICITUD ACTUAL:',
      'Cliente confirma interés en la Ram.',
      'Pide horario: no',
      'Pide ubicación: no',
    ].join('\n');
    const out = sanitizeInventedResumenFlags(inventado, 'Bueno', last);
    expect(out).toMatch(/Pide horario: sí/i);
    expect(out).toMatch(/Pide ubicación: no/i);
  });

  it('un ok suelto sin pregunta de horario no inventa horario', () => {
    const last =
      'Tenemos la Ram 700 2023 blanca. ¿Le gustó o hay algo que le detiene?';
    const out = sanitizeInventedResumenFlags(
      'SOLICITUD ACTUAL:\nSigue.\nPide horario: sí\nPide ubicación: sí',
      'ok',
      last,
    );
    expect(out).toMatch(/Pide horario: no/i);
    expect(out).toMatch(/Pide ubicación: no/i);
  });

  it('3 filas se queda si lo dijo', () => {
    expect(textAsksForTresFilas('Es de 3 filas ?')).toBe(true);
    const out = sanitizeInventedResumenFlags(
      'SOLICITUD ACTUAL:\nValidar filas.\nTres filas: sí\nAsientos: 7',
      'Es de 3 filas ?',
    );
    expect(out).toMatch(/Tres filas: sí/i);
    expect(out).toMatch(/Asientos: no/i);
  });

  it('otras mañana no es catálogo de este turno', () => {
    expect(otrasDiferidas('para ver otras opciones mañana')).toBe(true);
    expect(otrasDiferidas('Me ayudaría con otras opciones')).toBe(false);
    expect(otrasDiferidas('atienden mañana?')).toBe(false);
    expect(otrasDiferidas('puedo ir mañana?')).toBe(false);
    const out = sanitizeInventedResumenFlags(
      'SOLICITUD ACTUAL:\nCliente quiere ver otras.\nPide otras: sí',
      'para ver otras opciones mañana',
    );
    expect(out).toMatch(/Pide otras: no/i);
  });
});
