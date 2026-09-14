import { isBotStopped } from './is-bot-stopped';

describe('isBotStopped', () => {
  it('apaga el bot si atiende IA? es true', () => {
    expect(
      isBotStopped({
        custom_fields_values: [
          { field_id: 2991944, values: [{ value: 'hola' }] },
          {
            field_id: 2991942,
            field_name: 'atiende IA?',
            values: [{ value: true }],
          },
        ],
      }),
    ).toBe(true);
  });

  it('sigue si el checkbox no viene', () => {
    expect(
      isBotStopped({
        custom_fields_values: [
          { field_id: 2991944, values: [{ value: 'hola' }] },
        ],
      }),
    ).toBe(false);
  });
});
