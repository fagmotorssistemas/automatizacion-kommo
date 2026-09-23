import {
  parseResumen,
  resumenAsksForCredit,
  resumenAsksForListedPrice,
  resumenAsksForOtherColor,
  resumenHasPendingDoubt,
  resumenIsFarewell,
  textAsksForOtherColor,
} from './parse-resumen';

describe('resumenAsksForListedPrice', () => {
  it('lee la bandera del analizador, no la palabra del cliente', () => {
    expect(
      resumenAsksForListedPrice(
        'SOLICITUD ACTUAL:\nCliente quiere el precio.\nPide precio: sí',
      ),
    ).toBe(true);
    expect(
      resumenAsksForListedPrice(
        'SOLICITUD ACTUAL:\nCliente pregunta cuánto.\nPide precio: sí',
      ),
    ).toBe(true);
    expect(
      resumenAsksForListedPrice(
        'SOLICITUD ACTUAL:\nCliente quiere los km.\nPide precio: no',
      ),
    ).toBe(false);
  });

  it('si no hay bandera, usa lo que escribió el analizador', () => {
    expect(
      resumenAsksForListedPrice(
        'SOLICITUD ACTUAL:\nCliente quiere el precio.',
      ),
    ).toBe(true);
    expect(
      resumenAsksForListedPrice(
        'SOLICITUD ACTUAL:\nCliente quiere el valor.',
      ),
    ).toBe(true);
    expect(
      resumenAsksForListedPrice(
        'SOLICITUD ACTUAL:\nCliente quiere la cuota.',
      ),
    ).toBe(false);
    expect(
      resumenAsksForListedPrice(
        'SOLICITUD ACTUAL:\nCliente quiere un precio menor.',
      ),
    ).toBe(false);
  });

  it('sigue parseando vehículo y solicitud', () => {
    const parsed = parseResumen(`RESUMEN PREVIO:
Vehículo: Optra 2012
Contexto: fotos enviadas

SOLICITUD ACTUAL:
Cliente quiere el precio.
Pide precio: sí`);
    expect(parsed.vehiculo).toBe('Optra 2012');
    expect(parsed.solicitudActual).toMatch(/quiere el precio/i);
  });
});

describe('contado y crédito', () => {
  it('lee si pidió crédito además del precio', () => {
    expect(
      resumenAsksForCredit(
        'SOLICITUD ACTUAL:\nCliente quiere precio de contado y a crédito.\nPide precio: sí\nPide crédito: sí',
      ),
    ).toBe(true);
    expect(
      resumenAsksForListedPrice(
        'SOLICITUD ACTUAL:\nCliente quiere precio de contado y a crédito.\nPide precio: sí\nPide crédito: sí',
      ),
    ).toBe(true);
    expect(
      resumenAsksForCredit(
        'SOLICITUD ACTUAL:\nCliente quiere el precio.\nPide precio: sí\nPide crédito: no',
      ),
    ).toBe(false);
  });
});

describe('otro color', () => {
  it('lee si pidió otro color del mismo modelo', () => {
    expect(
      resumenAsksForOtherColor(
        'SOLICITUD ACTUAL:\nCliente quiere otro color del Sportage.\nPide precio: no\nPide otro color: sí',
      ),
    ).toBe(true);
    expect(
      resumenAsksForOtherColor(
        'SOLICITUD ACTUAL:\nCliente quiere el precio.\nPide precio: sí\nPide otro color: no',
      ),
    ).toBe(false);
    expect(textAsksForOtherColor('No tienen otro color?')).toBe(true);
    expect(textAsksForOtherColor('Cuál es el precio de contado')).toBe(false);
  });
});

describe('duda vs despedida', () => {
  it('una duda pendiente no es cierre', () => {
    const resumen = `SOLICITUD ACTUAL:
Cliente cree que no son de segunda y agradece.
Pide precio: no
Tiene duda: sí
Es despedida: no`;
    expect(resumenHasPendingDoubt(resumen)).toBe(true);
    expect(resumenIsFarewell(resumen)).toBe(false);
  });

  it('duda del km de la unidad pide precio y no cierra', () => {
    const resumen = `SOLICITUD ACTUAL:
Cliente duda si 11000 km cuadra con el 2024; confirmar unidad y precio.
Pide precio: sí
Tiene duda: sí
Es despedida: no`;
    expect(resumenAsksForListedPrice(resumen)).toBe(true);
    expect(resumenHasPendingDoubt(resumen)).toBe(true);
    expect(resumenIsFarewell(resumen)).toBe(false);
  });

  it('seguir en contacto no es despedida', () => {
    expect(
      resumenIsFarewell(
        'SOLICITUD ACTUAL:\nCliente sigue interesado pero no ahora.\nPide precio: no\nTiene duda: no\nEs despedida: no',
      ),
    ).toBe(false);
  });

  it('despedida solo si el analizador lo marca y no hay duda', () => {
    expect(
      resumenIsFarewell(
        'SOLICITUD ACTUAL:\nCliente no quiere seguir.\nEs despedida: sí\nTiene duda: no',
      ),
    ).toBe(true);
    expect(
      resumenIsFarewell(
        'SOLICITUD ACTUAL:\nCliente se va pero pregunta si son usados.\nEs despedida: sí\nTiene duda: sí',
      ),
    ).toBe(false);
  });
});
