import { sanitizePlateShort } from './plate-short';

describe('sanitizePlateShort', () => {
  it('deja el apodo corto', () => {
    expect(sanitizePlateShort('P7')).toBe('P7');
    expect(sanitizePlateShort('l5')).toBe('L5');
  });

  it('un UUID no es placa', () => {
    expect(
      sanitizePlateShort('61d90585-7047-4db8-bb7f-1cf9f2ced204'),
    ).toBeNull();
    expect(sanitizePlateShort('62434e00')).toBeNull();
  });
});
