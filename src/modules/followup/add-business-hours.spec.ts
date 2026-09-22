import { addBusinessHours } from './add-business-hours';

describe('addBusinessHours', () => {
  it('si escribe a las 16:00 un martes, 8h laborales caen al día siguiente 14:30', () => {
    const from = new Date('2026-09-15T16:00:00-05:00'); // martes
    const result = addBusinessHours(from, 8);
    expect(result.toISOString()).toBe(
      new Date('2026-09-16T14:30:00-05:00').toISOString(),
    );
  });

  it('salta el domingo al acumular horas', () => {
    const from = new Date('2026-09-18T17:00:00-05:00'); // viernes 17:00 → 1h
    const result = addBusinessHours(from, 8);
    // vie 1h + sáb 4h = 5h; quedan 3h → lunes 08:30+3h = 11:30
    expect(result.toISOString()).toBe(
      new Date('2026-09-21T11:30:00-05:00').toISOString(),
    );
  });
});
