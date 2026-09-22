import { addBusinessHours, afterDelayInBusinessHours, snapToBusinessOpen } from './add-business-hours';

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

describe('snapToBusinessOpen / afterDelayInBusinessHours', () => {
  it('1:00 am martes salta a 08:30 del mismo día', () => {
    const at = snapToBusinessOpen(new Date('2026-09-15T01:00:00-05:00'));
    expect(at.toISOString()).toBe(
      new Date('2026-09-15T08:30:00-05:00').toISOString(),
    );
  });

  it('40 min desde las 22:00 cae al próximo horario laboral', () => {
    const from = new Date('2026-09-15T22:00:00-05:00'); // martes noche
    const result = afterDelayInBusinessHours(from, 40 * 60 * 1000);
    expect(result.toISOString()).toBe(
      new Date('2026-09-16T08:30:00-05:00').toISOString(),
    );
  });
});
