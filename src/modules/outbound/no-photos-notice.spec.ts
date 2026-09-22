import { appendNoPhotosNotice } from './no-photos-notice';

describe('appendNoPhotosNotice', () => {
  it('agrega el aviso una sola vez', () => {
    const once = appendNoPhotosNotice('Tenemos la Hilux.');
    expect(once).toContain('no tengo fotos');
    expect(appendNoPhotosNotice(once)).toBe(once);
  });
});
