import {
  DEALERSHIP_ADDRESS,
  replyGatesInfoOnEntrada,
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

  it('si ya dio la cuota, la conserva y agrega la dirección', () => {
    const out = ungateLocationReply(
      'La cuota aproximada es de $517.61 mensuales. Para darle la dirección, primero se confirma la entrada.',
    );
    expect(out).toMatch(/517\.61/);
    expect(out).toMatch(/Av\. España/i);
    expect(out).not.toMatch(/primero se confirma la entrada/i);
  });
});
