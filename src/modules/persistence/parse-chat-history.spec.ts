import { chatRowToMemoryMessage } from './parse-chat-history';

describe('chatRowToMemoryMessage', () => {
  it('human real es cliente; RESUMEN PREVIO no', () => {
    expect(
      chatRowToMemoryMessage({ type: 'human', content: 'hay ranger?' }),
    ).toEqual({ role: 'user', content: 'hay ranger?' });
    expect(
      chatRowToMemoryMessage({
        type: 'human',
        content: 'RESUMEN PREVIO:\nVehículo: Ranger',
      }),
    ).toBeNull();
  });

  it('ai saca la respuesta hablada si n8n guardó el JSON', () => {
    expect(
      chatRowToMemoryMessage({
        type: 'ai',
        content: JSON.stringify({
          respuesta_cliente: 'Sí, tenemos Ranger.',
          meta: { vehiculo: null },
        }),
      }),
    ).toEqual({ role: 'assistant', content: 'Sí, tenemos Ranger.' });
  });
});
