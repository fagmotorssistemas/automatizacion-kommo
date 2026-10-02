import {
  parsePricedUnitsFromReview,
  stripUnsolicitedPriceAndPlate,
  stripZeroListedPrice,
} from './strip-unsolicited-price';

describe('stripUnsolicitedPriceAndPlate', () => {
  it('no toca el $ y deja plate_short del Tunland', () => {
    const raw =
      'Estimado, tenemos disponible un Foton Tunland 2023 color plateado, con 113692 km, transmisión manual y precio de $21800. La placa es P7. Aquí tiene también las fotos del vehículo.';
    const clean = stripUnsolicitedPriceAndPlate(raw);
    expect(clean).toMatch(/21800/);
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

  it('el km no es placa', () => {
    const clean = stripUnsolicitedPriceAndPlate(
      'Estimado, tenemos un Chevrolet D-max CRDI 2023. La placa es 77613. Aquí tiene las fotos.',
      { keepPlateShort: true },
    );
    expect(clean).not.toMatch(/placa/i);
    expect(clean).not.toMatch(/77613/);
    expect(clean.toLowerCase()).toContain('d-max');
  });

  it('quita el primer bloque hex del UUID pegado como placa', () => {
    const clean = stripUnsolicitedPriceAndPlate(
      'Estimado, tenemos un Nissan X-Trail 2016. La placa es 62434e00. Aquí tiene las fotos.',
      { keepPlateShort: true },
    );
    expect(clean).not.toMatch(/62434e00/i);
    expect(clean).not.toMatch(/placa/i);
    expect(clean.toLowerCase()).toContain('x-trail');
  });

  it('quita un UUID pegado como placa', () => {
    const clean = stripUnsolicitedPriceAndPlate(
      'Estimado, tenemos disponible una Toyota Hilux SR 2023 color plateado, con 13086 km, transmisión manual y 4x4. La placa es 61d90585-7047-4db8-bb7f-1cf9f2ced204. Por ahora no tengo fotos de este vehículo para enviarle.',
    );
    expect(clean).not.toMatch(/61d90585/i);
    expect(clean).not.toMatch(/7047-4db8/i);
    expect(clean).not.toMatch(/placa/i);
    expect(clean).toMatch(/Hilux SR 2023/i);
    expect(clean).toMatch(/13086/i);
  });

  it('quita placa inventada con guion', () => {
    const clean = stripUnsolicitedPriceAndPlate(
      'Estimado, tenemos un Toyota 4Runner 2004. La placa es JYQ-3454. Aquí tiene también las fotos.',
    );
    expect(clean).not.toMatch(/JYQ/i);
    expect(clean).not.toMatch(/3454/);
    expect(clean.toLowerCase()).toContain('4runner');
  });

  it('una proforma conserva precio, entrada y cuota', () => {
    const raw =
      'El Chevrolet d-max crdi 2.5 cd 4x4 2022 color vino, con 87687 km y transmisión manual, tiene un precio de $32,990. Con $1,000 de entrada para financiar a 5 años la cuota aproximada sería de $962.39 mensuales.';
    const clean = stripUnsolicitedPriceAndPlate(raw);
    expect(clean).toMatch(/32,990/);
    expect(clean).toMatch(/1,000/);
    expect(clean).toMatch(/962\.39/);
  });

  it('no se come palabras de la cuota', () => {
    const raw =
      'Con una entrada de $4,000 y un plazo de 4 años, la cuota sería de $654.68 mensuales.';
    expect(stripUnsolicitedPriceAndPlate(raw)).toBe(raw);
  });

  it('un texto sin montos que quitar queda igual', () => {
    const raw = 'Con una entrada de la que usted disponga vemos la cuota.';
    expect(stripZeroListedPrice(raw)).toBe(raw);
    expect(stripUnsolicitedPriceAndPlate(raw)).toBe(raw);
  });

  it('no se come “placa empieza con” como si fuera un token de placa', () => {
    const raw =
      'La placa empieza con P (matriculado por primera vez en Pichincha) y termina en 5.';
    expect(stripUnsolicitedPriceAndPlate(raw, { keepPlateShort: true })).toBe(
      raw,
    );
  });

  it('quita $0 y no toca un precio real', () => {
    expect(stripZeroListedPrice('El valor es $0.')).not.toMatch(/\$0/);
    expect(stripZeroListedPrice('El precio es $00')).not.toMatch(/\$0/);
    expect(stripZeroListedPrice('El X-Trail está en $16890.')).toMatch(/16890/);
  });

  it('lee precio=$ o el hint del marcador en la revisión', () => {
    const review = `modelo=ranger xlt | año=2026 | color=plomo | km=22868 | precio={{precio:u1}} ($68800)
modelo=ranger xl | año=2024 | color=plomo | km=11061 | precio=$44590`;
    expect(parsePricedUnitsFromReview(review)).toEqual([
      { price: 68800, year: 2026, color: 'plomo', mileage: 22868 },
      { price: 44590, year: 2024, color: 'plomo', mileage: 11061 },
    ]);
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
