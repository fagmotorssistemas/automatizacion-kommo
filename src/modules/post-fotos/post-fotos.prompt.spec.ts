import {
  flattenPostFotosMessage,
  postFotosSystemPrompt,
  postFotosUserPrompt,
} from './post-fotos.prompt';

describe('post-fotos prompt', () => {
  it('paso 1 habla de validar / qué le pasó', () => {
    expect(postFotosSystemPrompt(1)).toMatch(/VALIDAR/i);
  });

  it('paso 2 pregunta qué le pareció', () => {
    expect(postFotosSystemPrompt(2)).toMatch(/PARECIÓ|pareció/i);
  });

  it('paso 3 habla de documentos/placas, no garantía del carro', () => {
    const p = postFotosSystemPrompt(3);
    expect(p).toMatch(/documentos|placas al día|35 años/i);
    expect(p).toMatch(/PROHIBIDO[\s\S]*garantía/i);
  });

  it('arma el user con datos del carro', () => {
    const text = postFotosUserPrompt({
      name: 'Juan',
      brand: 'kia',
      model: 'picanto',
      year: 2023,
      price: 15990,
      mileage: 40000,
      fuelType: 'gasolina',
      color: 'blanco',
    });
    expect(text).toContain('nombre: Juan');
    expect(text).toContain('modelo: picanto');
  });

  it('aplana saltos de línea', () => {
    expect(flattenPostFotosMessage('Hola Juan\n¿Le gustó?')).toBe(
      'Hola Juan ¿Le gustó?',
    );
  });
});
