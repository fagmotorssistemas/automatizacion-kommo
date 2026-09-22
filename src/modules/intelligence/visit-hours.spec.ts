import {
  fitsSaturdayHours,
  fitsWeekdayHours,
  formatVisitHourHint,
  looksLikeClock,
  parseCustomerClock,
} from './visit-hours';

describe('looksLikeClock', () => {
  it('detecta horas reales', () => {
    expect(looksLikeClock('1:00 pm')).toBe(true);
    expect(looksLikeClock('mañana a las 10 estoy ahí')).toBe(true);
    expect(looksLikeClock('10 de la noche')).toBe(true);
    expect(looksLikeClock('1')).toBe(true);
  });

  it('ignora números que no son hora', () => {
    expect(looksLikeClock('quiero 7 pasajeros')).toBe(false);
    expect(looksLikeClock('Foton Tunland 2023')).toBe(false);
    expect(looksLikeClock('a cuántos meses queda')).toBe(false);
    expect(looksLikeClock('me interesa una hilux')).toBe(false);
  });
});

describe('parseCustomerClock', () => {
  it('1:00 pm es 13:00', () => {
    expect(parseCustomerClock('1:00 pm')).toEqual({
      hour: 13,
      minute: 0,
      label: '13:00',
    });
  });

  it('1 pm es 13:00', () => {
    expect(parseCustomerClock('1 pm')?.label).toBe('13:00');
  });

  it('1 de la tarde es 13:00', () => {
    expect(parseCustomerClock('1 de la tarde')?.label).toBe('13:00');
  });

  it('1 de la mañana es 01:00, no 13:00', () => {
    expect(parseCustomerClock('1 de la mañana')?.label).toBe('01:00');
  });

  it('6 de la mañana es 06:00, no 18:00', () => {
    expect(parseCustomerClock('6 de la mañana')?.label).toBe('06:00');
  });

  it('8 de la noche es 20:00', () => {
    expect(parseCustomerClock('8 de la noche')?.label).toBe('20:00');
  });

  it('11 de la noche es 23:00', () => {
    expect(parseCustomerClock('11 de la noche')?.label).toBe('23:00');
  });

  it('mañana a la 1 (día + hora) es 13:00, no madrugada', () => {
    expect(parseCustomerClock('mañana a la 1')?.label).toBe('13:00');
  });

  it('a las 10 / 11 sin noche son diurnas', () => {
    expect(parseCustomerClock('a las 10')?.label).toBe('10:00');
    expect(parseCustomerClock('a las 11')?.label).toBe('11:00');
    expect(parseCustomerClock('a las 8')?.label).toBe('08:00');
    expect(parseCustomerClock('a las 13')?.label).toBe('13:00');
  });

  it('solo "de la noche" pasa a 20–23', () => {
    expect(parseCustomerClock('a las 10 de la noche')?.label).toBe('22:00');
    expect(parseCustomerClock('a las 11')?.label).toBe('11:00');
  });

  it('10 de la mañana es 10:00', () => {
    expect(parseCustomerClock('10 de la mañana')?.label).toBe('10:00');
  });

  it('10 de la noche es 22:00', () => {
    expect(parseCustomerClock('10 de la noche')?.label).toBe('22:00');
  });

  it('13:00 ya es 24h', () => {
    expect(parseCustomerClock('13:00')?.label).toBe('13:00');
  });
});

describe('fitsSaturdayHours', () => {
  it('13:00 cabe el sábado', () => {
    expect(fitsSaturdayHours(13, 0)).toBe(true);
  });

  it('13:30 cabe el sábado', () => {
    expect(fitsSaturdayHours(13, 30)).toBe(true);
  });

  it('14:00 no cabe el sábado', () => {
    expect(fitsSaturdayHours(14, 0)).toBe(false);
  });
});

describe('fitsWeekdayHours', () => {
  it('13:00 cabe L-V', () => {
    expect(fitsWeekdayHours(13, 0)).toBe(true);
  });

  it('noche no cabe L-V', () => {
    expect(fitsWeekdayHours(20, 0)).toBe(false);
  });

  it('madrugada no cabe L-V', () => {
    expect(fitsWeekdayHours(6, 0)).toBe(false);
  });
});

describe('formatVisitHourHint', () => {
  it('1:00 pm sí cabe sábado', () => {
    const hint = formatVisitHourHint('1:00 pm');
    expect(hint).toContain('13:00');
    expect(hint).toMatch(/SÍ cabe el sábado/i);
    expect(hint).toMatch(/Prohibido decir que no es posible/i);
  });

  it('mañana a las 10 sí cabe y no es noche', () => {
    const hint = formatVisitHourHint('mañana a las 10 estoy ahí');
    expect(hint).toContain('10:00');
    expect(hint).toMatch(/SÍ cabe L-V/i);
    expect(hint).not.toMatch(/FUERA DE ATENCIÓN/i);
    expect(hint).toMatch(/NUNCA asumas que es de noche/i);
  });

  it('a las 11 sin noche sí cabe diurno', () => {
    const hint = formatVisitHourHint('a las 11');
    expect(hint).toContain('11:00');
    expect(hint).toMatch(/SÍ cabe L-V/i);
    expect(hint).not.toMatch(/FUERA DE ATENCIÓN/i);
  });

  it('2:00 pm no cabe sábado', () => {
    const hint = formatVisitHourHint('2:00 pm');
    expect(hint).toContain('14:00');
    expect(hint).toMatch(/sábado NO/i);
  });

  it('6 de la mañana no cabe y no se confirma', () => {
    const hint = formatVisitHourHint('6 de la mañana');
    expect(hint).toContain('06:00');
    expect(hint).toMatch(/FUERA DE ATENCIÓN/i);
    expect(hint).toMatch(/Prohibido confirmar/i);
  });

  it('10 de la noche no cabe', () => {
    const hint = formatVisitHourHint('10 de la noche');
    expect(hint).toContain('22:00');
    expect(hint).toMatch(/Prohibido confirmar/i);
  });

  it('8 de la noche no cabe', () => {
    const hint = formatVisitHourHint('8 de la noche');
    expect(hint).toContain('20:00');
    expect(hint).toMatch(/Prohibido confirmar/i);
  });

  it('no inyecta hint en mensajes sin hora', () => {
    expect(formatVisitHourHint('quiero 7 pasajeros')).toBe('');
    expect(formatVisitHourHint('Foton Tunland 2023')).toBe('');
  });
});
