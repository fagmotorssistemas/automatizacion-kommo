import {
  assembleDynamicContext,
  buildIntentsInput,
  parseIntentsPayload,
  promptNamesFromIntents,
  toFetchPromptNames,
} from './assemble-dynamic-context';

describe('assembleDynamicContext', () => {
  it('pone rol primero', () => {
    const text = assembleDynamicContext([
      { name: 'compra', content: 'c' },
      { name: 'rol', content: 'r' },
    ]);
    expect(text.indexOf('# ROL')).toBeLessThan(text.indexOf('# COMPRA'));
  });

  it('siempre incluye rol en los nombres', () => {
    expect(promptNamesFromIntents(['Compra', 'HORARIOS'])).toEqual([
      'rol',
      'compra',
      'horarios',
    ]);
  });

  it('manejo_caro y cliente no sabe pegan con agent_prompts', () => {
    expect(promptNamesFromIntents(['manejo_caro', 'cliente no sabe'])).toEqual([
      'rol',
      'manejocaro',
      'clientenosabe',
    ]);
  });

  it('parsea intenciones', () => {
    expect(parseIntentsPayload('{"intenciones":["compra"]}')).toEqual([
      'compra',
    ]);
  });

  it('tira nombres que no existen en agent_prompts', () => {
    expect(
      promptNamesFromIntents(
        ['compra', 'consulta_modelo', 'manejo_caro'],
        ['rol', 'compra', 'manejocaro', 'objeciones', 'curriculum'],
      ),
    ).toEqual(['rol', 'compra', 'manejocaro']);
  });

  it('si curriculum está en patio se carga', () => {
    expect(
      promptNamesFromIntents(
        ['curriculum', 'hoja de vida'],
        ['rol', 'compra', 'curriculum'],
      ),
    ).toEqual(['rol', 'curriculum']);
  });

  it('el fetch usa el name tal cual está en patio', () => {
    expect(
      toFetchPromptNames(
        ['rol', 'vehiculossimilares'],
        ['rol', 'vehiculossimilares '],
      ),
    ).toEqual(['rol', 'vehiculossimilares ']);
  });

  it('el clasificador recibe el hilo masticado, no solo el resumen', () => {
    const text = buildIntentsInput({
      resumen:
        'SOLICITUD ACTUAL:\nCliente objeta el precio.\nObjeción de precio: sí',
      stayOnShown: true,
      fichaAlreadyGiven: true,
      askedPrice: true,
      priceObjection: true,
    });
    expect(text).toMatch(/Unidad en hilo: sí/);
    expect(text).toMatch(/Ficha ya presentada: sí/);
    expect(text).toMatch(/Pide el precio: no/);
    expect(text).toMatch(/Objeta el valor: sí/);
  });
});
