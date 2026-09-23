import {
  parseResumen,
  resumenAsksForListedPrice,
  resumenHasPendingDoubt,
  resumenIsFarewell,
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
