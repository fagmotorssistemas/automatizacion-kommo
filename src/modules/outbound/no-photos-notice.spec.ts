import { appendNoPhotosNotice } from './no-photos-notice';

describe('appendNoPhotosNotice', () => {
  it('agrega el aviso una sola vez', () => {
    const once = appendNoPhotosNotice('Tenemos la Hilux.');
    expect(once).toContain('no tengo fotos');
    expect(appendNoPhotosNotice(once)).toBe(once);
  });

  it('quita el "aquí tiene las fotos" si no hay fotos', () => {
    const text = appendNoPhotosNotice(
      'Estimado, tenemos disponible un Ford ranger XLT 2026 color plomo, con 0 km, transmisión automática y diesel. La placa es P8. Aquí tiene también las fotos del vehículo.',
    );
    expect(text).not.toMatch(/aqu[ií] tiene tambi[eé]n las fotos/i);
    expect(text).toContain('Ford ranger XLT 2026');
    expect(text).toContain('La placa es P8.');
    expect(text).toContain('no tengo fotos de este vehículo');
  });
});
