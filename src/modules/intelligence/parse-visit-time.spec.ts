import { resolveVisitTime } from './parse-visit-time';

describe('resolveVisitTime', () => {
  const now = new Date('2026-09-14T17:00:00.000Z');

  it('mañana + hora de la tarde arma visit_datetime', () => {
    const resolved = resolveVisitTime(
      {
        time_reference: 'mañana a las 5 de la tarde',
        day_detected: 'mañana',
        hour_detected: '5 de la tarde',
      },
      now,
    );
    expect(resolved.day_detected).toBe('2026-09-15');
    expect(resolved.hour_detected).toBe('17:00');
    expect(resolved.visit_datetime).toBe('2026-09-15T17:00:00');
  });

  it('franja horaria no es hora', () => {
    const resolved = resolveVisitTime(
      {
        time_reference: 'en la tarde',
        day_detected: 'lunes',
        hour_detected: 'en la tarde',
      },
      now,
    );
    expect(resolved.hour_detected).toBeNull();
    expect(resolved.visit_datetime).toBeNull();
  });

  it('1 de la mañana es 01:00, no 13:00', () => {
    const resolved = resolveVisitTime(
      {
        time_reference: 'mañana a la 1 de la mañana',
        day_detected: 'mañana',
        hour_detected: '1 de la mañana',
      },
      now,
    );
    expect(resolved.hour_detected).toBe('01:00');
    expect(resolved.visit_datetime).toBe('2026-09-15T01:00:00');
  });

  it('10 de la noche es 22:00', () => {
    const resolved = resolveVisitTime(
      {
        time_reference: 'hoy a las 10 de la noche',
        day_detected: 'hoy',
        hour_detected: '10 de la noche',
      },
      now,
    );
    expect(resolved.hour_detected).toBe('22:00');
  });
});
