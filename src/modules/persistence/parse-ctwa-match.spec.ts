import { parseCtwaMatch } from './parse-ctwa-match';

describe('parseCtwaMatch', () => {
  it('lee matched y ad_headline', () => {
    expect(
      parseCtwaMatch({
        matched: true,
        ad_headline: 'Hilux 2022',
        captured_at: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual({
      matched: true,
      adHeadline: 'Hilux 2022',
      capturedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('sin match queda false', () => {
    expect(parseCtwaMatch(null)).toEqual({
      matched: false,
      adHeadline: null,
      capturedAt: null,
    });
  });
});
