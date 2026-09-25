import {
  assessMileageForYear,
  ensureListedPrice,
  formatMileageFact,
  formatMileageForPrompt,
  formatUnitMileage,
  hasLoadedMileage,
} from './mileage';

describe('mileage', () => {
  it('0 no es kilometraje: el dato no está cargado', () => {
    expect(hasLoadedMileage(0)).toBe(false);
    expect(hasLoadedMileage(null)).toBe(false);
    expect(hasLoadedMileage(11061)).toBe(true);
    expect(formatUnitMileage(0)).toMatch(/aún no cargado/i);
    expect(formatUnitMileage(0)).not.toMatch(/, 0 km/);
    expect(formatUnitMileage(11061)).toBe(', 11061 km');
    expect(formatMileageFact(0)).toMatch(/aún no cargado/i);
    expect(formatMileageFact(0)).not.toMatch(/^km=0$/);
    expect(formatMileageForPrompt(0)).toMatch(/aún no cargado/i);
  });

  it('15.000 es mínimo y 20.000 es tope', () => {
    const bajo = assessMileageForYear(11061, 2024, 2026);
    expect(bajo.fit).toBe('bajo');
    expect(bajo.min).toBe(30000);
    expect(bajo.max).toBe(40000);
    expect(bajo.note).toMatch(/mínimo/i);

    const acorde = assessMileageForYear(170000, 2016, 2026);
    expect(acorde.fit).toBe('acorde');
    expect(acorde.min).toBe(150000);
    expect(acorde.max).toBe(200000);

    const enTope = assessMileageForYear(200000, 2016, 2026);
    expect(enTope.fit).toBe('acorde');

    const alto = assessMileageForYear(220000, 2016, 2026);
    expect(alto.fit).toBe('alto');
    expect(alto.note).toMatch(/carro cuidado/i);
    expect(alto.note).toMatch(/PROHIBIDO/i);
    expect(alto.note).toMatch(/aunque/i);
    expect(alto.note).toMatch(/mecánico/i);
  });

  it('si ya lo dijo no vuelve a pedir el texto del mecánico', () => {
    const fact = formatMileageFact(77613, 2023, 2026, { skipClientCare: true });
    expect(fact).toMatch(/km=77613/);
    expect(fact).not.toMatch(/mecánico/i);
    expect(fact).not.toMatch(/AL CLIENTE/i);
  });

  it('si pidió el precio y no vino el dólar, se pone y se quita el mecánico', () => {
    const raw =
      'Este Kia Seltos 2020 color plomo Está en Cuenca, con papeles en regla y entrega inmediata. El kilometraje es acorde al año, es un carro cuidado y en buen estado; puede traer a su mecánico para revisar.';
    const clean = ensureListedPrice(raw, 19990);
    expect(clean).toMatch(/\$19,990/);
    expect(clean).toMatch(/Cuenca/i);
    expect(clean).not.toMatch(/mecánico/i);
    expect(clean).not.toMatch(/kilometraje es acorde/i);
  });

  it('si el recado ya trajo un $, no pega otro encima', () => {
    const already = 'El Prado 2016 dorado tiene un precio de $53800.';
    const clean = ensureListedPrice(already, 14990);
    expect(clean).toBe(already);
    expect(clean).not.toMatch(/14,?990/);
  });

  it('si el precio se cortó, no deja la y colgada', () => {
    const raw =
      'Estimado, tenemos disponible un Santa Fe 2018 color azul, con 124923 km, y';
    const clean = ensureListedPrice(raw, 22990);
    expect(clean).toMatch(/\$22,990/);
    expect(clean).toMatch(/124923 km\./);
    expect(clean).not.toMatch(/km, y/);
  });
});
