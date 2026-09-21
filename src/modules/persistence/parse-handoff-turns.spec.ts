import {
  handoffTurnsToAgentMessages,
  parseHandoffTurns,
} from './parse-handoff-turns';

describe('parseHandoffTurns', () => {
  it('arma el array cliente/asesor', () => {
    expect(
      parseHandoffTurns([
        { role: 'customer', text: 'Hola', at: 't1' },
        { role: 'seller', name: 'Vanessa', text: 'Le llamo', at: 't2' },
        { role: 'bot', text: 'ignorar' },
      ]),
    ).toEqual([
      { role: 'customer', name: null, text: 'Hola', at: 't1' },
      { role: 'seller', name: 'Vanessa', text: 'Le llamo', at: 't2' },
    ]);
  });

  it('pasa al agente turnos user/assistant ya masticados', () => {
    expect(
      handoffTurnsToAgentMessages([
        { role: 'customer', name: null, text: 'Hola', at: 't1' },
        { role: 'seller', name: 'Vanessa', text: 'Le llamo en 10', at: 't2' },
      ]),
    ).toEqual([
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: '[Asesor Vanessa]: Le llamo en 10' },
    ]);
  });
});
