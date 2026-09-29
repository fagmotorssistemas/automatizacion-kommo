import {
  appendUnloadedPrice,
  dropRepeatedListedPrice,
  ensureListedSetPrices,
  isStrippedReplyStub,
  parsePricedUnitsFromReview,
  stripListedPriceAmounts,
  stripUnloadedPriceClaim,
  messageLeaksPrice,
  PRICE_UNLOADED,
  stripUnsolicitedPriceAndPlate,
  stripZeroListedPrice,
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

  it('si recorta el $ de la entrada no deja “y financiamiento…”', () => {
    const clean = stripUnsolicitedPriceAndPlate(
      'Con una entrada de $8000 y financiamiento a 48 meses para el Hyundai Santa Fe 2018.',
    );
    expect(clean).not.toMatch(/^y financiamiento/i);
    expect(clean).toMatch(/financiamiento a 48 meses/i);
    expect(clean).toMatch(/Santa Fe 2018/i);
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
    expect(clean).not.toMatch(/962\.39/);
    expect(clean).toMatch(/d-max/i);
  });

  it('quita la cuota 280.05 y el hueco “está en.” si no pidió precio', () => {
    const clean = stripUnsolicitedPriceAndPlate(
      'El Peugeot 2008 2022 está en $19,990. Con una entrada de $11,000 la cuota aproximada sería de $280.05.',
    );
    expect(clean).not.toMatch(/19,990|19990|11,000|11000|280\.05/);
    expect(clean).not.toMatch(/\$/);
    expect(clean).not.toMatch(/está en\./i);
    expect(clean).toMatch(/Peugeot 2008 2022/i);
  });

  it('con precio permitido no se comen palabras de la cuota (A76351)', () => {
    const raw =
      'Con una entrada de $4,000 y un plazo de 4 años, la cuota sería de $654.68 mensuales.';
    expect(stripUnsolicitedPriceAndPlate(raw, { keepPrice: true })).toBe(raw);
    expect(stripUnsolicitedPriceAndPlate(raw, { keepPrice: true })).toMatch(
      /con una entrada de \$4,000.*la cuota sería de \$654\.68 mensuales/i,
    );
  });

  it('un texto sin montos que quitar queda igual', () => {
    const raw = 'Con una entrada de la que usted disponga vemos la cuota.';
    expect(stripListedPriceAmounts(raw)).toBe(raw);
    expect(stripZeroListedPrice(raw)).toBe(raw);
  });

  it('dropRepeatedListedPrice quita la frase del precio ya dicho y deja la cuota', () => {
    const out = dropRepeatedListedPrice(
      'El precio de contado del Kia Sportage 2019 es $22,900. Con una entrada de $4,000 y un plazo de 4 años, la cuota es $654.68.',
      22900,
    );
    expect(out).not.toMatch(/22,900/);
    expect(out).toBe(
      'Con una entrada de $4,000 y un plazo de 4 años, la cuota es $654.68.',
    );
  });

  it('dropRepeatedListedPrice no vacía el mensaje ni toca frases con la cuota', () => {
    const solo = 'El precio es $22,900.';
    expect(dropRepeatedListedPrice(solo, 22900)).toBe(solo);
    const junto = 'Son $22,900 y la cuota es $522.88.';
    expect(dropRepeatedListedPrice(junto, 22900)).toBe(junto);
    expect(dropRepeatedListedPrice('Entrada de $4,000.', 22900)).toBe(
      'Entrada de $4,000.',
    );
  });

  it('detecta fuga de precio', () => {
    expect(messageLeaksPrice('precio de $21800')).toBe(true);
    expect(messageLeaksPrice('Tenemos la Tunland disponible. La placa es P7.')).toBe(
      false,
    );
  });

  it('quita $0 y no toca un precio real', () => {
    expect(stripZeroListedPrice('El valor es $0.')).not.toMatch(/\$0/);
    expect(stripZeroListedPrice('El precio es $00')).not.toMatch(/\$0/);
    expect(stripZeroListedPrice('El X-Trail está en $16890.')).toMatch(/16890/);
    expect(appendUnloadedPrice('El valor es $0.')).toContain(PRICE_UNLOADED);
    const invented = appendUnloadedPrice(
      'Tenemos un Kia Sportage 2019 color blanco y precio de $18,500. El precio de esta unidad aún no está cargado en patio.',
    );
    expect(invented).not.toMatch(/18,?500/);
    expect(invented).not.toMatch(/\$/);
    expect(invented).toContain(PRICE_UNLOADED);
    expect(
      stripUnloadedPriceClaim(
        'Estimado, no tenemos el precio cargado aún para vehículos Nissan SUV. El precio de esta unidad aún no está cargado en patio.',
      ),
    ).toBe('');
  });

  it('A76116 el listado de Rangers no deja $ inventados', () => {
    const invented =
      'El Ford Ranger XLT AC 2.0 CD 4x4 automática diesel 2026 color plomo está en $70,000, y el Ranger XL AC 2.0 CD 4x2 manual diesel 2024 color plomo en $65,000. ¿Cuál desea ver?';
    const units = [
      { year: 2026, color: 'plomo', mileage: 22868, price: 68800 },
      { year: 2024, color: 'plomo', mileage: 11061, price: 44590 },
    ];
    const clean = ensureListedSetPrices(invented, units);
    expect(clean).toMatch(/68,?800/);
    expect(clean).toMatch(/44,?590/);
    expect(clean).not.toMatch(/70,?000/);
    expect(clean).not.toMatch(/65,?000/);
    expect(clean).toMatch(/2026/);
    expect(clean).toMatch(/2024/);
  });

  it('si el listado quedó sin $ los pega al lado de cada año', () => {
    const stripped =
      'El Ford Ranger XLT AC 2.0 CD 4x4 automática diesel 2026 color plomo. y el Ranger XL AC 2.0 CD 4x2 manual diesel 2024 color plomo en. ¿Cuál desea ver?';
    const clean = ensureListedSetPrices(stripped, [
      { year: 2026, color: 'plomo', mileage: 22868, price: 68800 },
      { year: 2024, color: 'plomo', mileage: 11061, price: 44590 },
    ]);
    expect(clean).toMatch(/68,?800/);
    expect(clean).toMatch(/44,?590/);
  });

  it('si el listado ya trae los $ de patio no lo reescribe', () => {
    const ok =
      'El Ranger XLT 2026 está en $68,800 y el XL 2024 en $44,590. ¿Cuál desea ver?';
    expect(
      ensureListedSetPrices(ok, [
        { year: 2026, price: 68800 },
        { year: 2024, price: 44590 },
      ]),
    ).toBe(ok);
  });

  it('lee precio=$ de la revisión', () => {
    const review = `modelo=ranger xlt | año=2026 | color=plomo | km=22868 | precio=$68800
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

  it('un resto “El” tras quitar el $ es un stub', () => {
    expect(isStrippedReplyStub('El')).toBe(true);
    expect(isStrippedReplyStub('El precio es')).toBe(true);
    expect(isStrippedReplyStub('El precio del Hyundai Santa Fe 2018 es.')).toBe(
      false,
    );
  });
});
