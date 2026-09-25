import {
  formatHoursAskHint,
  getDealershipClock,
  hourInGuayaquil,
} from './dealership-hours';

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

describe('formatHoursAskHint', () => {
  it('viernes: hoy atienden y mañana sábado 09:30 a 13:30, no habitual', () => {
    const text = formatHoursAskHint(new Date('2026-09-25T14:06:00-05:00'));
    expect(text).toMatch(/Hoy es Viernes: SÍ atienden, 08:30 a 18:00/);
    expect(text).toMatch(/Mañana es Sábado: SÍ atienden, 09:30 a 13:30/);
    expect(text).toMatch(/PROHIBIDO "horario habitual"/);
    expect(text).toMatch(/PROHIBIDO ofrecer carro/);
  });

  it('sábado: hoy atienden y mañana domingo cerrado', () => {
    const text = formatHoursAskHint(new Date('2026-09-26T10:00:00-05:00'));
    expect(text).toMatch(/Hoy es Sábado: SÍ atienden, 09:30 a 13:30/);
    expect(text).toMatch(/Mañana es Domingo: NO atienden/);
  });

  it('domingo: hoy cerrado y mañana lunes sí', () => {
    const text = formatHoursAskHint(new Date('2026-09-27T10:00:00-05:00'));
    expect(text).toMatch(/Hoy es Domingo: NO atienden/);
    expect(text).toMatch(/Mañana es Lunes: SÍ atienden, 08:30 a 18:00/);
  });
});
