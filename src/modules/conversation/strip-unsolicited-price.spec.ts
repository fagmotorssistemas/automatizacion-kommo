import {
  messageLeaksPrice,
  stripUnsolicitedPriceAndPlate,
} from './strip-unsolicited-price';

describe('stripUnsolicitedPriceAndPlate', () => {
  it('quita precio y deja plate_short del Tunland', () => {
    const raw =
      'Estimado, tenemos disponible un Foton Tunland 2023 color plateado, con 113692 km, transmisión manual y precio de $21800. La placa es P7. Aquí tiene también las fotos del vehículo.';
    const clean = stripUnsolicitedPriceAndPlate(raw);
    expect(clean).not.toMatch(/21800/);
    expect(clean).not.toMatch(/\$/);
    expect(clean).toMatch(/placa es P7/i);
    expect(clean.toLowerCase()).toContain('tunland');
    expect(clean.toLowerCase()).toContain('fotos');
  });

  it('quita placa completa y deja plate_short', () => {
    const clean = stripUnsolicitedPriceAndPlate(
      'Unidad lista. La placa es PDW7157. La corta es P7.',
    );
    expect(clean).not.toMatch(/PDW7157/i);
    expect(clean).toMatch(/\bP7\b/);
  });

  it('detecta fuga de precio', () => {
    expect(messageLeaksPrice('precio de $21800')).toBe(true);
    expect(messageLeaksPrice('Tenemos la Tunland disponible. La placa es P7.')).toBe(
      false,
    );
  });
});
