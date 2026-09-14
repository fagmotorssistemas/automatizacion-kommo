import { phoneForLeadColumn, usablePhone } from './usable-phone';

describe('usablePhone', () => {
  it('acepta un teléfono real', () => {
    expect(usablePhone(' +593999000111 ')).toBe('+593999000111');
  });

  it('rechaza el placeholder de n8n', () => {
    expect(usablePhone('Sin número')).toBeNull();
    expect(phoneForLeadColumn(null)).toBe('Sin número');
  });
});
