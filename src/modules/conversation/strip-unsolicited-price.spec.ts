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

  it('quita placa inventada con guion', () => {
    const clean = stripUnsolicitedPriceAndPlate(
      'Estimado, tenemos un Toyota 4Runner 2004. La placa es JYQ-3454. Aquí tiene también las fotos.',
    );
    expect(clean).not.toMatch(/JYQ/i);
    expect(clean).not.toMatch(/3454/);
    expect(clean.toLowerCase()).toContain('4runner');
  });

  it('detecta fuga de precio', () => {
    expect(messageLeaksPrice('precio de $21800')).toBe(true);
    expect(messageLeaksPrice('Tenemos la Tunland disponible. La placa es P7.')).toBe(
      false,
    );
  });

  it('si no preguntó placa quita también la corta', () => {
    const clean = stripUnsolicitedPriceAndPlate(
      'El X-Trail 2016 azul tiene 144904 km. La placa es L5, con documentos en regla.',
      { keepPlateShort: false },
    );
    expect(clean).not.toMatch(/placa/i);
    expect(clean).toMatch(/144904/);
    expect(clean).toMatch(/documentos en regla/i);
  });
});
