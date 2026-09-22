import {
  detectVehicleKind,
  formatPedidoVigente,
  resolveVehicleKind,
} from './vehicle-kind';

describe('vehicle kind', () => {
  it('detecta camioneta, pickup y doble cabina', () => {
    expect(detectVehicleKind('quiero una camioneta para el trabajo')).toBe(
      'camioneta',
    );
    expect(detectVehicleKind('busco un pickup')).toBe('camioneta');
    expect(detectVehicleKind('doble cabina diesel')).toBe('camioneta');
  });

  it('en el mismo mensaje gana el tipo que dijo al final', () => {
    expect(detectVehicleKind('no quiero suv, quiero camioneta')).toBe(
      'camioneta',
    );
    expect(detectVehicleKind('la camioneta no, mejor una suv')).toBe('suv');
  });

  it('mantiene camioneta cuando luego pide una poer', () => {
    expect(
      resolveVehicleKind({
        history: [
          { role: 'user', content: 'Estoy interesado en una camioneta' },
          {
            role: 'assistant',
            content: 'Le recomiendo una Ford Ranger y una BYD Yuan Pro',
          },
        ],
        customerText: 'De esas no, yo buscaba como las poer o una parecida',
        remembered: null,
      }),
    ).toBe('camioneta');
  });

  it('no deja que el mensaje del bot cambie el tipo', () => {
    expect(
      resolveVehicleKind({
        history: [
          { role: 'user', content: 'quiero camioneta' },
          { role: 'assistant', content: 'Tenemos una SUV Jeep y un sedán' },
        ],
        customerText: 'la más barata',
        remembered: null,
      }),
    ).toBe('camioneta');
  });

  it('usa el tipo guardado cuando ya no está en los mensajes recientes', () => {
    expect(
      resolveVehicleKind({
        history: [{ role: 'user', content: 'y el financiamiento?' }],
        customerText: 'a cuántos meses',
        remembered: 'camioneta',
      }),
    ).toBe('camioneta');
  });

  it('cambia el tipo guardado si el cliente pide otro', () => {
    expect(
      resolveVehicleKind({
        history: [{ role: 'user', content: 'quiero camioneta' }],
        customerText: 'mejor muéstrame una suv',
        remembered: 'camioneta',
      }),
    ).toBe('suv');
  });

  it('el pedido vigente nombra el tipo y la poer cuando es camioneta', () => {
    const text = formatPedidoVigente('camioneta');
    expect(text).toContain('Tipo: camioneta');
    expect(text).toContain('great wall poer');
    expect(formatPedidoVigente('suv')).not.toContain('poer');
    expect(formatPedidoVigente(null)).toBe('');
  });
});
