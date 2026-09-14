export const OPENAI_AGENT_CONFIG = 'OPENAI_AGENT_CONFIG';

export type OpenAiAgentConfig = {
  apiKey: string;
  model: string;
  embeddingModel: string;
};
