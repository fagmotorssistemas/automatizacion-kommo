import {
  assembleDynamicContext,
  parseIntentsPayload,
  promptNamesFromIntents,
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

  it('parsea intenciones', () => {
    expect(parseIntentsPayload('{"intenciones":["compra"]}')).toEqual([
      'compra',
    ]);
  });
});
