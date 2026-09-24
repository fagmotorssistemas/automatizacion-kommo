import {
  CASH_DELIVERY_CONFIRM,
  ensureCashDeliveryConfirm,
  replyOnlyRepeatedPrice,
} from './cash-delivery';

describe('contado y entrega inmediata', () => {
  const last =
    'Estimado, el Kia Sportage 2019 plateado automático con 113,170 km tiene un precio de $21,500.';

  it('detecta que solo repitió el precio', () => {
    expect(replyOnlyRepeatedPrice(last, last)).toBe(true);
    expect(
      replyOnlyRepeatedPrice(
        'Ese $21,500 es de contado y hay entrega inmediata.',
        last,
      ),
    ).toBe(false);
  });

  it('no deja el mismo $ si pidió contado y entrega', () => {
    expect(ensureCashDeliveryConfirm(last, last)).toBe(CASH_DELIVERY_CONFIRM);
    expect(ensureCashDeliveryConfirm(last, last)).toMatch(/contado/i);
    expect(ensureCashDeliveryConfirm(last, last)).toMatch(/entrega inmediata/i);
    expect(
      ensureCashDeliveryConfirm(
        'Estimado, el Kia Sportage 2019 plateado automático con 113,170 km',
        last,
      ),
    ).toBe(CASH_DELIVERY_CONFIRM);
  });
});
