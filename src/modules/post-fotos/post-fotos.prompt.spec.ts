import {
  flattenPostFotosMessage,
  postFotosUserPrompt,
} from './post-fotos.prompt';

describe('post-fotos prompt', () => {
  it('arma el user como n8n', () => {
    const text = postFotosUserPrompt({
      leadIdKommo: 123,
      contactId: 456,
      name: 'Juan',
      brand: 'kia',
      model: 'picanto',
      year: 2023,
      price: 15990,
      mileage: 40000,
      fuelType: 'gasolina',
      color: 'blanco',
    });
    expect(text).toContain('lead_id:123');
    expect(text).toContain('nombre: Juan');
    expect(text).toContain('modelo:picanto');
    expect(text).toContain('kilometraje:40000');
  });

  it('aplana saltos de línea como el Code node', () => {
    expect(flattenPostFotosMessage('Hola Juan\n¿Viene al patio?')).toBe(
      'Hola Juan ¿Viene al patio?',
    );
  });
});
