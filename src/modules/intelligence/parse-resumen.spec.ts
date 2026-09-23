import {
  parseResumen,
  resumenAsksForListedPrice,
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
