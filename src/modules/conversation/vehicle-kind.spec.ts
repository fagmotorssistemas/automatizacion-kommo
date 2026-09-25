import {
  detectVehicleKind,
  formatPedidoVigente,
  kindFromTypeBody,
  matchesVehicleKind,
  resolveVehicleKind,
} from './vehicle-kind';

describe('vehicle kind', () => {
  it('la camioneta no cuenta un jeep como el mismo tipo', () => {
    expect(matchesVehicleKind('doble cabina', 'camioneta')).toBe(true);
    expect(matchesVehicleKind('jeep', 'camioneta')).toBe(false);
    expect(matchesVehicleKind('jeep', 'suv')).toBe(true);
  });

  it('camionetita es camioneta, también si está mal escrita', () => {
    expect(detectVehicleKind('una camionetita más económica')).toBe('camioneta');
    expect(detectVehicleKind('una cmioneta')).toBe('camioneta');
    expect(detectVehicleKind('busco una camioenta')).toBe('camioneta');
    expect(detectVehicleKind('la camionetta')).toBe('camioneta');
    expect(detectVehicleKind('una cmaioneta')).toBe('camioneta');
    expect(detectVehicleKind('el camionero llegó')).toBeNull();
  });

  it('doble cabina y cabina simple son camioneta', () => {
    expect(kindFromTypeBody('doble cabina')).toBe('camioneta');
    expect(kindFromTypeBody('cabina doble')).toBe('camioneta');
    expect(kindFromTypeBody('cabina simple')).toBe('camioneta');
    expect(kindFromTypeBody('jeep')).toBe('suv');
  });

  it('el carro de interés manda aunque antes haya dicho suv', () => {
    expect(
      resolveVehicleKind({
        history: [{ role: 'user', content: 'quiero una suv' }],
        customerText: 'algo más económico, de menos año',
        remembered: 'suv',
        interestedKind: 'camioneta',
      }),
    ).toBe('camioneta');
  });

  it('si en este mensaje pide suv, ese dicho actualiza', () => {
    expect(
      resolveVehicleKind({
        history: [],
        customerText: 'mejor muéstrame una suv',
        remembered: 'camioneta',
        interestedKind: 'camioneta',
      }),
    ).toBe('suv');
  });

  it('detecta camioneta, pickup y doble cabina', () => {
    expect(detectVehicleKind('quiero una camioneta para el trabajo')).toBe(
      'camioneta',
    );
    expect(detectVehicleKind('busco un pickup')).toBe('camioneta');
    expect(detectVehicleKind('Pikup')).toBe('camioneta');
    expect(detectVehicleKind('doble cabina diesel')).toBe('camioneta');
    expect(detectVehicleKind('Una Chevrolet doble cabina 4 x 2')).toBe(
      'camioneta',
    );
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

  it('doble cabina 4x2 no se vuelve SUV aunque el carro anterior fuera jeep', () => {
    expect(
      resolveVehicleKind({
        history: [],
        customerText: 'Una Chevrolet doble cabina 4 x 2',
        remembered: 'suv',
        interestedKind: 'suv',
      }),
    ).toBe('camioneta');
  });

  it('el pedido vigente nombra el tipo y la poer cuando es camioneta', () => {
    const text = formatPedidoVigente('camioneta');
    expect(text).toContain('Tipo: camioneta');
    expect(text).toContain('Doble cabina');
    expect(formatPedidoVigente('suv')).toContain('Tipo: suv');
    expect(formatPedidoVigente(null)).toBe('');
  });
});
