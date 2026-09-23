import {
  assessMileageForYear,
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
});
