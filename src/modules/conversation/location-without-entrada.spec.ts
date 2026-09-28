import {
  appendMapLink,
  DEALERSHIP_ADDRESS,
  MAP_URL,
  replyGatesInfoOnEntrada,
  stripDepositDisclaimer,
  ungateLocationReply,
} from './location-without-entrada';

describe('ubicación sin pedir entrada', () => {
  it('detecta el candado de entrada para dar la dirección', () => {
    expect(
      replyGatesInfoOnEntrada(
        'Para coordinar la visita y darle la dirección, primero se confirma la entrada en la empresa.',
      ),
    ).toBe(true);
    expect(
      replyGatesInfoOnEntrada(
        'Correcto, usted confirma que debe entregar la entrada primero para reservar y así poder coordinar la visita.',
      ),
    ).toBe(true);
    expect(
      replyGatesInfoOnEntrada(
        'El financiamiento con $3,000 a 72 meses tiene una cuota de $517.61 mensuales.',
      ),
    ).toBe(false);
  });

  it('suelta la dirección y no pide entrada', () => {
    const out = ungateLocationReply(
      'Para coordinar la visita y darle la dirección, primero se confirma la entrada en la empresa. Así podemos atenderle mejor.',
    );
    expect(out).toBe(DEALERSHIP_ADDRESS);
    expect(out).toMatch(/Av\. España/i);
    expect(out).not.toMatch(/primero se confirma la entrada/i);
  });

  it('la dirección no lleva la frase del depósito', () => {
    const out = stripDepositDisclaimer(
      'La puede visitar en Av. España 6-73 y Sevilla, Cuenca. No es necesario ningún depósito para la dirección.',
    );
    expect(out).toBe('La puede visitar en Av. España 6-73 y Sevilla, Cuenca.');
    expect(out).not.toMatch(/dep[oó]sito/i);
  });

  it('si ya dio la cuota, la conserva y agrega la dirección', () => {
    const out = ungateLocationReply(
      'La cuota aproximada es de $517.61 mensuales. Para darle la dirección, primero se confirma la entrada.',
    );
    expect(out).toMatch(/517\.61/);
    expect(out).toMatch(/Av\. España/i);
    expect(out).not.toMatch(/primero se confirma la entrada/i);
  });
});

describe('link del mapa junto a la dirección', () => {
  it('el mapa es el enlace corto de la ubicación de Fag Motors', () => {
    expect(MAP_URL).toBe('https://maps.app.goo.gl/vxJe7vw4cxNMQXtq8');
  });

  it('pega el mapa cuando la respuesta trae la dirección', () => {
    const out = appendMapLink(DEALERSHIP_ADDRESS);
    expect(out).toContain(DEALERSHIP_ADDRESS);
    expect(out.trim().endsWith(MAP_URL)).toBe(true);
  });

  it('si cierra con una pregunta, el mapa va antes y la pregunta queda al final', () => {
    const out = appendMapLink(
      'Estamos en Av. España 6-73 y Sevilla, Cuenca. ¿Qué carro le interesa?',
    );
    expect(out).toBe(
      `Estamos en Av. España 6-73 y Sevilla, Cuenca.\n\nAquí la ubicación en el mapa: ${MAP_URL}\n\n¿Qué carro le interesa?`,
    );
    expect(out.endsWith('¿Qué carro le interesa?')).toBe(true);
  });

  it('una pregunta ANTES de la dirección no mueve el mapa', () => {
    const out = appendMapLink(
      '¿Desea venir? Estamos en Av. España 6-73 y Sevilla, Cuenca.',
    );
    expect(out.trim().endsWith(MAP_URL)).toBe(true);
  });

  it('no repite el mapa si ya está', () => {
    const once = appendMapLink(DEALERSHIP_ADDRESS);
    expect(appendMapLink(once)).toBe(once);
  });

  it('sin dirección en la respuesta no pega el mapa', () => {
    expect(appendMapLink('Con gusto le ayudo con el precio.')).toBe(
      'Con gusto le ayudo con el precio.',
    );
  });
});
