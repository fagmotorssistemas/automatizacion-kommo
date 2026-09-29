import {
  calcularFinanciamiento,
  calcularFinanciamientoBancario,
  formatFinancingQuote,
} from './financiamiento';

describe('financiamiento', () => {
  it('CrediFAG si la entrada es >= 60%', () => {
    const result = JSON.parse(
      calcularFinanciamiento({ precio: 20000, entrada_cliente: 12000 }),
    );
    expect(result.camino).toBe('A');
    expect(result.cuota_aprox).toEqual(expect.any(Number));
  });

  it('pide años si la entrada es baja', () => {
    const result = JSON.parse(
      calcularFinanciamiento({ precio: 20000, entrada_cliente: 2000 }),
    );
    expect(result.camino).toBe('B');
    expect(result.requiere_plazo_anos).toBe(true);
  });

  it('calcula cuota bancaria', () => {
    const result = JSON.parse(
      calcularFinanciamientoBancario({
        precio: 20000,
        entrada_cliente: 2000,
        anos: 3,
      }),
    );
    expect(result.camino).toBe('B');
    expect(result.meses).toBe(36);
    expect(result.cuota_aprox).toEqual(expect.any(Number));
  });

  it('arma la frase de cuota con entrada y meses', () => {
    const quote = formatFinancingQuote({
      precio: 22990,
      entrada: 8000,
      anos: 4,
    });
    expect(quote).toMatch(/entrada de \$8,000/i);
    expect(quote).toMatch(/48 meses/i);
    expect(quote).toMatch(/cuota aproximada es \$\d+\.\d{2}/i);
    expect(quote).not.toMatch(/^y financiamiento/i);
  });
});
