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
});
