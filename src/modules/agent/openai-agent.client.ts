import { Inject, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { MemoryMessage } from '../conversation/conversation.service';
import {
  OPENAI_AGENT_CONFIG,
  type OpenAiAgentConfig,
} from './openai-agent.config';
import { SALES_TOOL_DEFINITIONS } from './sales-tools';

const MAX_TOOL_ROUNDS = 6;

@Injectable()
export class OpenAiAgentClient {
  private readonly logger = new Logger(OpenAiAgentClient.name);
  private readonly openai: OpenAI | null;
  private readonly model: string;
  private readonly embeddingModel: string;

  constructor(@Inject(OPENAI_AGENT_CONFIG) config: OpenAiAgentConfig) {
    this.openai = config.apiKey ? new OpenAI({ apiKey: config.apiKey }) : null;
    this.model = config.model;
    this.embeddingModel = config.embeddingModel;
  }

  isReady(): boolean {
    return this.openai !== null;
  }

  async complete(system: string, user: string): Promise<string | null> {
    if (!this.openai) {
      this.logger.warn('OPENAI_API_KEY vacío; no se llama al modelo');
      return null;
    }

    const result = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    return result.choices[0]?.message?.content?.trim() || null;
  }

  async embed(text: string): Promise<number[] | null> {
    if (!this.openai || !text.trim()) {
      return null;
    }

    const result = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });

    return result.data[0]?.embedding ?? null;
  }

  async runSalesAgent(input: {
    system: string;
    user: string;
    history: MemoryMessage[];
    executeTool: (name: string, argsJson: string) => Promise<string>;
  }): Promise<string | null> {
    if (!this.openai) {
      this.logger.warn('OPENAI_API_KEY vacío; no corre el agente');
      return null;
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: input.system },
      ...input.history.map((item) => ({
        role: item.role,
        content: item.content,
      })),
      { role: 'user', content: input.user },
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const result = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        tools: SALES_TOOL_DEFINITIONS,
      });

      const message = result.choices[0]?.message;
      if (!message) {
        return null;
      }

      messages.push(message);

      if (!message.tool_calls?.length) {
        return message.content?.trim() || null;
      }

      for (const call of message.tool_calls) {
        if (call.type !== 'function') {
          continue;
        }
        const output = await input.executeTool(
          call.function.name,
          call.function.arguments,
        );
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: output,
        });
      }
    }

    this.logger.warn('Agente cortado por exceso de tools');
    return null;
  }
}
