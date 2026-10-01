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

  it('lee product_retailer_id solo si viene', () => {
    expect(
      parseCtwaMatch({
        matched: true,
        ad_headline: 'Ford Explorer',
        captured_at: '2026-01-01T00:00:00.000Z',
        product_retailer_id: '479b66bd',
      }),
    ).toEqual({
      matched: true,
      adHeadline: 'Ford Explorer',
      capturedAt: '2026-01-01T00:00:00.000Z',
      productRetailerId: '479b66bd',
    });
  });
});
