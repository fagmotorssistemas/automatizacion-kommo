import { getDealershipClock, hourInGuayaquil } from './dealership-hours';

describe('getDealershipClock', () => {
  it('domingo está cerrado', () => {
    const clock = getDealershipClock(new Date('2026-09-13T15:00:00-05:00'));
    expect(clock.diaNombre).toBe('Domingo');
    expect(clock.estaAbierto).toBe(false);
    expect(clock.puedeVenirHoy).toBe(false);
    expect(clock.mensaje).toMatch(/lunes/i);
  });

  it('la hora de Cuenca no se confunde con UTC', () => {
    expect(hourInGuayaquil(new Date('2026-09-25T16:06:00Z'))).toBe(11);
    expect(hourInGuayaquil(new Date('2026-09-26T01:00:00Z'))).toBe(20);
  });

  it('lunes a media mañana está abierto', () => {
    const clock = getDealershipClock(new Date('2026-09-14T10:00:00-05:00'));
    expect(clock.diaNombre).toBe('Lunes');
    expect(clock.estaAbierto).toBe(true);
    expect(clock.puedeVenirHoy).toBe(true);
  });

  it('25 de diciembre es día normal, no feriado', () => {
    const clock = getDealershipClock(new Date('2026-12-25T10:00:00-05:00'));
    expect(clock.diaNombre).toBe('Viernes');
    expect(clock.estaAbierto).toBe(true);
    expect(clock.puedeVenirHoy).toBe(true);
    expect(clock.mensaje).not.toMatch(/diciembre|feriado/i);
  });
});
