import { buildChatHistoryRows } from './chat-history';

describe('buildChatHistoryRows', () => {
  it('guarda cliente como human y bot como ai', () => {
    expect(
      buildChatHistoryRows({
        sessionId: '59458509',
        human: 'me interesa una hilux',
        ai: 'Tenemos una Hilux disponible.',
      }),
    ).toEqual([
      {
        session_id: '59458509',
        message: {
          type: 'human',
          content: 'me interesa una hilux',
          additional_kwargs: {},
          response_metadata: {},
        },
      },
      {
        session_id: '59458509',
        message: {
          type: 'ai',
          content: 'Tenemos una Hilux disponible.',
          tool_calls: [],
          additional_kwargs: {},
          response_metadata: {},
          invalid_tool_calls: [],
        },
      },
    ]);
  });

  it('no guarda RESUMEN PREVIO como human ni como ai', () => {
    expect(
      buildChatHistoryRows({
        sessionId: '59458509',
        human: 'RESUMEN PREVIO:\nVehículo: Hilux',
        ai: 'RESUMEN PREVIO:\nVehículo: Hilux',
      }),
    ).toEqual([]);
  });
});
