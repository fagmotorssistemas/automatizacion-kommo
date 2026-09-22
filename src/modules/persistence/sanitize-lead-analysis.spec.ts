import {
  coerceTradeInYear,
  sanitizeLeadAnalysisPatch,
} from './sanitize-lead-analysis';

describe('sanitizeLeadAnalysisPatch', () => {
  it('convierte budget numérico a texto y descarta fecha basura', () => {
    expect(
      sanitizeLeadAnalysisPatch({
        budget: 12000,
        temperature: 'tibio',
        day_detected: 'mañana',
        hour_detected: '14:30',
        time_reference: '2026-09-22T14:30:00-05:00',
      }),
    ).toEqual({
      budget: '12000',
      temperature: 'tibio',
      hour_detected: '14:30:00',
      time_reference: new Date('2026-09-22T14:30:00-05:00').toISOString(),
    });
  });

  it('ignora temperatura desconocida', () => {
    expect(sanitizeLeadAnalysisPatch({ temperature: 'hot' })).toEqual({});
  });
});

describe('coerceTradeInYear', () => {
  it('acepta años razonables', () => {
    expect(coerceTradeInYear(2018)).toBe(2018);
    expect(coerceTradeInYear('2018')).toBe(2018);
  });

  it('rechaza basura', () => {
    expect(coerceTradeInYear('viejo')).toBeNull();
    expect(coerceTradeInYear(1800)).toBeNull();
  });
});
