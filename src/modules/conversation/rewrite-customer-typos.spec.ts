import {
  formatTransmissionTypoHint,
  rewriteCustomerTypos,
} from './rewrite-customer-typos';

describe('rewriteCustomerTypos', () => {
  it('Manuela → manual', () => {
    expect(rewriteCustomerTypos('Y talvez Manuela disponen')).toBe(
      'Y talvez manual disponen',
    );
  });

  it('colapsa espacios dobles en 4 runner', () => {
    expect(rewriteCustomerTypos('Toyota 4  runner')).toMatch(/4runner/i);
  });
});

describe('formatTransmissionTypoHint', () => {
  it('bloquea Manuela como modelo', () => {
    const hint = formatTransmissionTypoHint('Y talvez Manuela disponen');
    expect(hint).toMatch(/transmisión MANUAL/i);
    expect(hint).toMatch(/Prohibido decir que no hay un vehículo llamado Manuela/i);
    expect(hint).toMatch(/al azar/i);
  });

  it('vacío si no hay Manuela', () => {
    expect(formatTransmissionTypoHint('Picanto automático')).toBe('');
  });
});
