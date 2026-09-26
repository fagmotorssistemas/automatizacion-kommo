import { parseImageKind } from './classify-inbound-image';

describe('parseImageKind', () => {
  it('solo la palabra cedula abre el lector', () => {
    expect(parseImageKind('cedula')).toBe('cedula');
    expect(parseImageKind('Cédula')).toBe('cedula');
    expect(parseImageKind('cedula.')).toBe('cedula');
    expect(parseImageKind('{"tipo":"cedula"}')).toBe('cedula');
  });

  it('un carro o una duda se queda en vehículo', () => {
    expect(parseImageKind('vehiculo')).toBe('vehiculo');
    expect(parseImageKind('Es un Toyota Hilux rojo')).toBe('vehiculo');
    expect(parseImageKind('no es cedula')).toBe('vehiculo');
    expect(parseImageKind('{"tipo":"vehiculo"}')).toBe('vehiculo');
    expect(parseImageKind('')).toBe('vehiculo');
    expect(parseImageKind(null)).toBe('vehiculo');
  });
});
