import { parseLeadAnalysis } from './parse-lead-analysis';

describe('parseLeadAnalysis', () => {
  it('rescata JSON con basura y arma las 4 ramas', () => {
    const raw = `ok
{
  "actions": [
    { "action": "financing", "budget": "1500.00", "financing": true },
    { "action": "identity", "ci": "0102030405" },
    { "action": "trade_in", "brand": "Chevrolet", "model": "Sail", "year": 2018, "mileage": 40000 },
    { "action": "signals", "da_fecha_visita": true, "presupuesto_mencionado": true }
  ],
  "action": "visit_time",
  "time_reference": "mañana",
  "day_detected": null,
  "hour_detected": "5"
} extra`;

    const parsed = parseLeadAnalysis(raw);
    expect(parsed?.financing).toEqual({ budget: '1500.00', financing: true });
    expect(parsed?.tradeIn).toEqual({
      brand: 'Chevrolet',
      model: 'Sail',
      year: 2018,
      mileage: 40000,
    });
    expect(parsed?.signals?.da_fecha_visita).toBe(true);
    expect(parsed?.signals?.presupuesto_mencionado).toBe(true);
    expect(parsed?.visitTime).toEqual({
      time_reference: 'mañana',
      day_detected: null,
      hour_detected: '5',
    });
    expect(parsed?.identity).toEqual({ ci: '0102030405' });
  });

  it('ignora financing vacío y un celular 09 como cédula', () => {
    const parsed = parseLeadAnalysis({
      actions: [
        { action: 'financing', budget: null, financing: null },
        { action: 'identity', ci: '0983335555' },
      ],
    });
    expect(parsed?.financing).toBeNull();
    expect(parsed?.signals).toBeNull();
    expect(parsed?.identity).toBeNull();
  });
});
