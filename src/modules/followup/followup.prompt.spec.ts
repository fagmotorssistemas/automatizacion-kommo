import { followupUserPrompt } from './followup.prompt';

describe('followupUserPrompt', () => {
  const fiat = {
    retoma: 1 as const,
    resumen:
      'El cliente mostró interés en el Fiat 500 lounge y quedó atento a más detalles para avanzar en la compra. No expresó objeciones ni mencionó presupuesto.',
    vehiculos: ['Fiat 500 lounge'],
    objecion: null,
    objecionTexto: null,
    objecionEvidencia: null,
    presupuesto: null,
  };

  it('manda preguntar por el carro, no pegar el informe del vendedor', () => {
    const prompt = followupUserPrompt(fiat);
    expect(prompt).toMatch(/Fiat 500 lounge/i);
    expect(prompt).toMatch(/pregúntale qué le pareció/i);
    expect(prompt).not.toContain('Resumen:');
    expect(prompt).not.toContain(fiat.resumen);
    expect(prompt).toMatch(/Así se ve bien:.*qué le pareció/i);
    expect(prompt).toMatch(/informe, no lo hagas/i);
  });

  it('retoma 2 usa lo que objetó, no una nota de "sin objeciones"', () => {
    const prompt = followupUserPrompt({
      ...fiat,
      retoma: 2,
      objecion: 'precio',
      objecionTexto: 'está caro',
      objecionEvidencia: 'está caro',
    });
    expect(prompt).toMatch(/está caro/);
    expect(prompt).toMatch(/sigue disponible|valida el rango/i);
    expect(prompt).not.toContain(fiat.resumen);
  });
});
