import {
  historyHasListedPrice,
  mergeResumenForNext,
  parseResumen,
  resumenAsksForCredit,
  resumenAsksForListedPrice,
  resumenAsksForOtherColor,
  resumenAsksForPhotos,
  resumenAsksForLocation,
  resumenHasPendingDoubt,
  resumenIsCourtesy,
  resumenIsThreadAck,
  resumenAceptaCredito,
  resumenPideNegociar,
  resumenPideOtras,
  resumenCajaCompra,
  resumenTopeContado,
  resumenFaltaVehiculo,
  resumenPideHorario,
  resumenAsientos,
  resumenTipoPatio,
  vehicleQueSigue,
  parseTopeAmount,
  resumenEsToma,
  resumenTomaFicha,
  stripTomaFacts,
  solicitudSinBanderas,
  resumenPrefiereContado,
  resumenAsksForImmediateDelivery,
  resumenRechazaAplicar,
  resumenIsFarewell,
  resumenIsPriceObjection,
  isThreadAck,
  textAsksForCredit,
  textAsksForListedPrice,
  textAsksForImmediateDelivery,
  textAsksForLocation,
  textAsksForOtherColor,
  textIsPriceObjection,
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

  it('si este turno suelta el vehículo, sigue el que ya había pedido', () => {
    const previous =
      'Vehículo: Mazda 3\nContexto: el bot mostró un MX3\nSOLICITUD: Cliente quiere un Mazda 3.';
    const current = `RESUMEN PREVIO:
Vehículo: No aplica
SOLICITUD ACTUAL:
Cliente no especificó qué carro.
Falta vehículo: sí`;
    expect(vehicleQueSigue(current, previous)).toBe('Mazda 3');
    expect(mergeResumenForNext(current, previous)).toMatch(/Vehículo: Mazda 3/);
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
    expect(
      resumenAsksForCredit(
        'SOLICITUD ACTUAL:\nCliente da 2000 de entrada a 6 años.\nPide precio: no\nPide crédito: no',
      ),
    ).toBe(true);
    expect(textAsksForCredit('2 mil de entrada')).toBe(true);
    expect(textAsksForCredit('Para 6 años')).toBe(true);
    expect(
      textAsksForCredit(
        'Para 5 años Melo haces proforma aver cuánto me cay de mensual',
      ),
    ).toBe(true);
    expect(textAsksForCredit('Aaa')).toBe(false);
    expect(textAsksForCredit('Buen')).toBe(false);
    expect(isThreadAck('Aaa')).toBe(true);
    expect(isThreadAck('Buen')).toBe(true);
    expect(
      textAsksForCredit('Aaa bueno voy buscar un poco de entrada mas'),
    ).toBe(false);
  });
});

describe('textAsksForListedPrice', () => {
  it('iel valor y cotizar piden el precio', () => {
    expect(textAsksForListedPrice('Si iel valor')).toBe(true);
    expect(textAsksForListedPrice('me puede alludar cotisando')).toBe(true);
    expect(textAsksForListedPrice('Dispongo de 10.000$')).toBe(false);
    expect(textAsksForListedPrice('El precio muy alto')).toBe(false);
    expect(textIsPriceObjection('El precio muy alto')).toBe(true);
    expect(textIsPriceObjection('Si iel valor')).toBe(false);
    expect(
      resumenIsPriceObjection(
        'SOLICITUD ACTUAL:\nCliente objeta el precio.\nPide precio: no\nObjeción de precio: sí',
      ),
    ).toBe(true);
    expect(
      resumenIsPriceObjection(
        'SOLICITUD ACTUAL:\nCliente quiere el precio.\nPide precio: sí\nObjeción de precio: no',
      ),
    ).toBe(false);
    expect(
      resumenAsksForListedPrice(
        'SOLICITUD ACTUAL:\nCliente dice que el precio es alto.\nPide precio: sí',
      ),
    ).toBe(false);
  });
});

describe('acepta crédito', () => {
  it('lee si ya hubo cuota y ahora acepta seguir', () => {
    expect(
      resumenAceptaCredito(
        'SOLICITUD ACTUAL:\nCliente acepta seguir con el crédito.\nAcepta crédito: sí',
      ),
    ).toBe(true);
    expect(
      resumenAceptaCredito(
        'SOLICITUD ACTUAL:\nCliente da otra entrada.\nAcepta crédito: no',
      ),
    ).toBe(false);
    expect(
      resumenRechazaAplicar(
        'SOLICITUD ACTUAL:\nCliente no quiere ver si aplica.\nRechaza aplicar: sí',
      ),
    ).toBe(true);
    expect(
      resumenPrefiereContado(
        'SOLICITUD ACTUAL:\nCliente se queda de contado.\nPrefiere contado: sí',
      ),
    ).toBe(true);
    expect(
      resumenPrefiereContado(
        'SOLICITUD ACTUAL:\nCliente dispone de 10000.\nPrefiere contado: no',
      ),
    ).toBe(false);
    expect(textAsksForImmediateDelivery('Al contado\nEntrega inmediata')).toBe(
      true,
    );
    expect(
      resumenAsksForImmediateDelivery(
        'SOLICITUD ACTUAL:\nCliente quiere el precio al contado con entrega inmediata.\nPide precio: sí',
      ),
    ).toBe(true);
    expect(
      resumenPideNegociar(
        'SOLICITUD ACTUAL:\nCliente pregunta si los precios son negociables.\nPide negociar: sí',
      ),
    ).toBe(true);
    expect(
      resumenAsksForListedPrice(
        'SOLICITUD ACTUAL:\nCliente pregunta si son negociables.\nPide precio: sí\nPide negociar: sí',
      ),
    ).toBe(false);
  });
});

describe('historyHasListedPrice', () => {
  it('detecta un $ ya dicho por el bot', () => {
    expect(
      historyHasListedPrice([
        { role: 'assistant', content: 'El precio es $15990.' },
      ]),
    ).toBe(true);
    expect(
      historyHasListedPrice([
        { role: 'assistant', content: 'El Chevrolet D-max tiene un precio de $28,990.' },
      ]),
    ).toBe(true);
    expect(
      historyHasListedPrice([
        { role: 'user', content: 'El precio muy alto' },
      ]),
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

describe('resumenPideOtras', () => {
  it('lee la bandera del analizador, no la frase del cliente', () => {
    expect(
      resumenPideOtras(
        'SOLICITUD ACTUAL:\nCliente quiere otras camionetas similares.\nPide otras: sí',
      ),
    ).toBe(true);
    expect(
      resumenPideOtras(
        'SOLICITUD ACTUAL:\nCliente quiere el precio de la Lariat.\nPide otras: no',
      ),
    ).toBe(false);
    expect(resumenPideOtras('Q otras tienen porfabor')).toBe(false);
  });
});

describe('resumenCajaCompra', () => {
  it('lee la caja de compra del analizador, no la palabra del cliente', () => {
    expect(
      resumenCajaCompra(
        'SOLICITUD ACTUAL:\nCliente quiere ver una camioneta y vendernos su Nativa automática.\nCaja de compra: no',
      ),
    ).toBe('no');
    expect(
      resumenCajaCompra(
        'SOLICITUD ACTUAL:\nCliente quiere Mitsubishi manual para el campo.\nCaja de compra: manual',
      ),
    ).toBe('manual');
    expect(
      resumenCajaCompra(
        'SOLICITUD ACTUAL:\nCliente quiere una Hilux automática.\nCaja de compra: automática',
      ),
    ).toBe('automatica');
    expect(
      resumenCajaCompra(
        'SOLICITUD ACTUAL:\nCliente quiere una camioneta usada y vendo automático.',
      ),
    ).toBeNull();
  });

  it('la solicitud sin banderas no arrastra caja de compra', () => {
    expect(
      solicitudSinBanderas(
        'SOLICITUD ACTUAL:\nCliente quiere Mitsubishi.\nCaja de compra: manual\nTope de contado: 23000\nFalta vehículo: no\nTipo de patio: no\nPide otras: no\nToma ya: marca=Jetour\nToma falta: placa\nToma pendiente: fotos',
      ),
    ).toBe('Cliente quiere Mitsubishi.');
  });
});

describe('resumenTopeContado', () => {
  it('lee el monto del analizador, no una frase del cliente', () => {
    expect(
      resumenTopeContado(
        'SOLICITUD ACTUAL:\nCliente no quiere que supere 23000.\nTope de contado: 23.000',
      ),
    ).toBe(23000);
    expect(
      resumenTopeContado(
        'SOLICITUD ACTUAL:\nCliente da 11000 de entrada.\nTope de contado: no',
      ),
    ).toBeNull();
    expect(resumenTopeContado('Por favor gracias que no supere los 23.000')).toBe(
      null,
    );
    expect(parseTopeAmount('23.000')).toBe(23000);
    expect(parseTopeAmount('10 mil')).toBe(10000);
    expect(parseTopeAmount('2012')).toBeNull();
  });
});

describe('resumenFaltaVehiculo', () => {
  it('lee la bandera del analizador, no una frase del cliente', () => {
    expect(
      resumenFaltaVehiculo(
        'SOLICITUD ACTUAL:\nCliente pide el valor pero no especificó qué carro.\nFalta vehículo: sí',
      ),
    ).toBe(true);
    expect(
      resumenFaltaVehiculo(
        'SOLICITUD ACTUAL:\nCliente quiere el precio de la X-Trail.\nFalta vehículo: no',
      ),
    ).toBe(false);
    expect(resumenFaltaVehiculo('A cómo sale')).toBe(false);
  });
});

describe('resumenPideHorario', () => {
  it('lee si pregunta si atienden, no el carro del hilo', () => {
    expect(
      resumenPideHorario(
        'SOLICITUD ACTUAL:\nCliente canceló la cita y pregunta si atienden mañana.\nPide horario: sí\nPide otras: no',
      ),
    ).toBe(true);
    expect(
      resumenPideHorario(
        'SOLICITUD ACTUAL:\nCliente quiere el precio de la Poer.\nPide horario: no',
      ),
    ).toBe(false);
  });
});

describe('resumenAsientos', () => {
  it('lee el número que puso el analizador, no una frase', () => {
    expect(
      resumenAsientos(
        'SOLICITUD ACTUAL:\nValidar si la Explorer tiene 7 plazas.\nAsientos: 7\nPide otras: no',
      ),
    ).toBe(7);
    expect(
      resumenAsientos(
        'SOLICITUD ACTUAL:\nCliente quiere el precio.\nAsientos: no',
      ),
    ).toBeNull();
  });
});

describe('resumenTipoPatio', () => {
  it('lee el tipo del analizador, no una frase del cliente', () => {
    expect(
      resumenTipoPatio(
        'SOLICITUD ACTUAL:\nCliente quiere un Chevrolet blanco.\nTipo de patio: suv',
      ),
    ).toBe('suv');
    expect(
      resumenTipoPatio(
        'SOLICITUD ACTUAL:\nCliente quiere un Chevrolet blanco.\nTipo de patio: no',
      ),
    ).toBe('no');
    expect(resumenTipoPatio('quiero un chevrolet blanco')).toBeNull();
  });
});

describe('resumenEsToma', () => {
  it('lee la toma del analizador, no una frase del cliente', () => {
    expect(
      resumenEsToma(
        'SOLICITUD ACTUAL:\nCliente quiere ver una camioneta y vendernos su Nativa 2011.\nToma: sí\nToma ficha: Nativa 2011 automática',
      ),
    ).toBe(true);
    expect(
      resumenEsToma(
        'SOLICITUD ACTUAL:\nCliente quiere una Hilux.\nToma: no\nToma ficha: no',
      ),
    ).toBe(false);
    expect(
      resumenEsToma(
        'SOLICITUD ACTUAL:\nCliente quiere ver una camioneta usada y vendernos su Nativa 2011 automática.\nCaja de compra: no',
      ),
    ).toBe(true);
    expect(resumenTomaFicha(
      'SOLICITUD ACTUAL:\nCliente quiere ver camioneta y vendernos su Nativa 2011 automática.\nToma: sí',
    )).toBe('Nativa 2011 automática');
    expect(
      stripTomaFacts(
        'Quiero una camioneta usada y vendo un nativa año 2011 automático',
        'Nativa 2011 automática',
      ),
    ).toBe('Quiero una camioneta usada y vendo un año');
  });
});

describe('resumenAsksForLocation', () => {
  it('lee ubicación o el candado de entrada para la dirección', () => {
    expect(
      resumenAsksForLocation(
        'SOLICITUD ACTUAL:\nCliente quiere confirmar que primero debe apostar la plata para obtener la dirección y coordinar la visita.',
      ),
    ).toBe(true);
    expect(
      textAsksForLocation(
        'Primero hay que apostar la plata para que le puedan dar la dirección para ir a ver.',
      ),
    ).toBe(true);
    expect(textAsksForLocation('Unos tres mil de entrada')).toBe(false);
    expect(
      resumenAsksForLocation(
        'SOLICITUD ACTUAL:\nCliente quiere el precio del Sportage.\nPide precio: sí',
      ),
    ).toBe(false);
  });
});

describe('resumenAsksForPhotos', () => {
  it('lee la solicitud del analizador, no la palabra del cliente', () => {
    expect(
      resumenAsksForPhotos(
        'SOLICITUD ACTUAL:\nCliente quiere que le envíen fotos o videos del Chevrolet Dmax 4x4 que mencionó.\nPide precio: no',
      ),
    ).toBe(true);
    expect(
      resumenAsksForPhotos(
        'SOLICITUD ACTUAL:\nCliente quiere la D-max 2023 y solicita fotos.\nPide precio: no',
      ),
    ).toBe(true);
    expect(
      resumenAsksForPhotos(
        'SOLICITUD ACTUAL:\nCliente quiere el precio del Sportage.\nPide precio: sí',
      ),
    ).toBe(false);
    expect(
      resumenAsksForPhotos(
        'SOLICITUD ACTUAL:\nCliente no solicita fotos; quiere el valor.\nPide precio: sí',
      ),
    ).toBe(false);
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

describe('resumenIsThreadAck', () => {
  it('lee la solicitud o la bandera; no inventa por “cuota” en el texto', () => {
    expect(
      resumenIsThreadAck(
        'SOLICITUD ACTUAL:\nCliente ya entendió la cuota.\nPide precio: no\nPide crédito: no',
      ),
    ).toBe(true);
    expect(
      resumenIsThreadAck(
        'SOLICITUD ACTUAL:\nCliente no quiere que le repitan la ficha ni la cuota.\nPide precio: no\nEs acuse: sí',
      ),
    ).toBe(true);
    expect(isThreadAck('listisimoo')).toBe(false);
    expect(
      resumenIsThreadAck(
        'SOLICITUD ACTUAL:\nCliente quiere el precio.\nPide precio: sí',
      ),
    ).toBe(false);
    expect(
      resumenIsThreadAck(
        'SOLICITUD ACTUAL:\nCliente quiere otra proforma.\nPide crédito: sí',
      ),
    ).toBe(false);
  });
});

describe('resumenIsCourtesy', () => {
  it('lee agradece o la bandera; el “gracias” del mensaje queda de respaldo', () => {
    expect(
      resumenIsCourtesy(
        'SOLICITUD ACTUAL:\nCliente agradece y sigue con la unidad.\nPide precio: no\nTiene duda: no\nEs despedida: no',
      ),
    ).toBe(true);
    expect(
      resumenIsCourtesy(
        'SOLICITUD ACTUAL:\nCliente sigue con la X-Trail.\nEs cortesía: sí\nTiene duda: no\nEs despedida: no',
      ),
    ).toBe(true);
    expect(
      resumenIsCourtesy(
        'SOLICITUD ACTUAL:\nCliente cree que no son de segunda y agradece.\nTiene duda: sí\nEs despedida: no',
      ),
    ).toBe(false);
    expect(
      resumenIsCourtesy(
        'SOLICITUD ACTUAL:\nCliente no quiere seguir.\nEs despedida: sí\nTiene duda: no',
      ),
    ).toBe(false);
    expect(
      resumenIsCourtesy(
        'SOLICITUD ACTUAL:\nCliente no quiere financiamiento ni visita ahora; sigue con ESA unidad.\nPide precio: no\nEs cortesía: sí\nEs despedida: no',
      ),
    ).toBe(false);
  });
});
