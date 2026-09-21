import { isRealCustomerText, isSyntheticCustomerText } from '../conversation/is-real-customer-text';

export type ChatHistorySpeaker = 'human' | 'ai';

export type ChatHistoryRow = {
  session_id: string;
  message: Record<string, unknown>;
};

export function toLangChainMessage(
  type: ChatHistorySpeaker,
  content: string,
): Record<string, unknown> {
  if (type === 'human') {
    return {
      type: 'human',
      content,
      additional_kwargs: {},
      response_metadata: {},
    };
  }

  return {
    type: 'ai',
    content,
    tool_calls: [],
    additional_kwargs: {},
    response_metadata: {},
    invalid_tool_calls: [],
  };
}

/** Cliente = human. Bot = ai. El resumen interno no es de ninguno. */
export function buildChatHistoryRows(input: {
  sessionId: string;
  human?: string;
  ai?: string;
}): ChatHistoryRow[] {
  const sessionId = input.sessionId.trim();
  if (!sessionId) {
    return [];
  }

  const rows: ChatHistoryRow[] = [];
  const human = input.human?.trim() ?? '';
  const ai = input.ai?.trim() ?? '';

  if (isRealCustomerText(human)) {
    rows.push({
      session_id: sessionId,
      message: toLangChainMessage('human', human),
    });
  }

  if (ai && !isSyntheticCustomerText(ai)) {
    rows.push({
      session_id: sessionId,
      message: toLangChainMessage('ai', ai),
    });
  }

  return rows;
}
