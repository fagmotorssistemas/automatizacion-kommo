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

  it('el km no es placa', () => {
    const clean = stripUnsolicitedPriceAndPlate(
      'Estimado, tenemos un Chevrolet D-max CRDI 2023. La placa es 77613. Aquí tiene las fotos.',
      { keepPlateShort: true },
    );
    expect(clean).not.toMatch(/placa/i);
    expect(clean).not.toMatch(/77613/);
    expect(clean.toLowerCase()).toContain('d-max');
  });

  it('quita “el precio registrado es .”', () => {
    const clean = stripUnsolicitedPriceAndPlate(
      'El Chevrolet D-max 2023 está en buen estado. El precio registrado es $28,990.',
    );
    expect(clean).not.toMatch(/28,990|28990|\$/);
    expect(clean).not.toMatch(/precio registrado es\s*\./i);
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

  it('no deja “a ;” cuando quita el precio', () => {
    const clean = stripUnsolicitedPriceAndPlate(
      'Sportage SL negro, manual, con 103736 km a $22200; GTI rojo, manual, con 91096 km a $22900.',
    );
    expect(clean).not.toMatch(/\$/);
    expect(clean).not.toMatch(/\ba\s*;/);
    expect(clean).toMatch(/103736 km/i);
    expect(clean).toMatch(/GTI rojo/i);
  });

  it('no deja huecos “es de .” ni “por al contado”', () => {
    const clean = stripUnsolicitedPriceAndPlate(
      'La Chevrolet Dmax 2020 está disponible por $22900 al contado. El precio de contado es de $22900. Con una entrada de $2000 y un plazo de 6 años.',
    );
    expect(clean).not.toMatch(/22900|2000/);
    expect(clean).not.toMatch(/\$/);
    expect(clean).not.toMatch(/por al contado/i);
    expect(clean).not.toMatch(/es de\s*\./i);
    expect(clean).not.toMatch(/entrada de y/i);
    expect(clean).toMatch(/Dmax 2020/i);
  });

  it('quita “precio de $13800” en la primera ficha', () => {
    const clean = stripUnsolicitedPriceAndPlate(
      'Estimado, tenemos disponible un Suzuki Grand Vitara 2015 color blanco, con 207051 km, transmisión 4x2 y precio de $13800. Aquí tiene también las fotos del vehículo.',
    );
    expect(clean).not.toMatch(/13800/);
    expect(clean).not.toMatch(/\$/);
    expect(clean).not.toMatch(/precio de/i);
    expect(clean).toMatch(/Grand Vitara 2015/i);
    expect(clean).toMatch(/fotos/i);
  });

  it('una proforma conserva precio, entrada y cuota', () => {
    const raw =
      'El Chevrolet d-max crdi 2.5 cd 4x4 2022 color vino, con 87687 km y transmisión manual, tiene un precio de $32,990. Con $1,000 de entrada para financiar a 5 años la cuota aproximada sería de $962.39 mensuales.';
    const clean = stripUnsolicitedPriceAndPlate(raw, { keepPrice: true });
    expect(clean).toMatch(/32,990/);
    expect(clean).toMatch(/1,000/);
    expect(clean).toMatch(/962\.39/);
  });

  it('si igual recorta el monto no deja “tiene un.” ni “Con de entrada”', () => {
    const clean = stripUnsolicitedPriceAndPlate(
      'El Chevrolet d-max, tiene un precio de $32,990. Con $1,000 de entrada para financiar a 5 años la cuota aproximada sería de $962.39 mensuales.',
    );
    expect(clean).not.toMatch(/32,990|1,000/);
    expect(clean).not.toMatch(/tiene un\s*\./i);
    expect(clean).not.toMatch(/con de entrada/i);
    expect(clean).toMatch(/962\.39/);
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
