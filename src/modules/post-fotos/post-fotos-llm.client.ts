import { Inject, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  OPENAI_AGENT_CONFIG,
  type OpenAiAgentConfig,
} from '../agent/openai-agent.config';
import type { PostFotosPaso } from './post-fotos.constants';
import {
  flattenPostFotosMessage,
  postFotosSystemPrompt,
  postFotosUserPrompt,
  type PostFotosCarInput,
} from './post-fotos.prompt';

@Injectable()
export class PostFotosLlmClient {
  private readonly logger = new Logger(PostFotosLlmClient.name);
  private readonly openai: OpenAI | null;
  private readonly model: string;

  constructor(@Inject(OPENAI_AGENT_CONFIG) config: OpenAiAgentConfig) {
    this.openai = config.apiKey ? new OpenAI({ apiKey: config.apiKey }) : null;
    this.model = config.model;
  }

  isReady(): boolean {
    return this.openai !== null;
  }

  async draft(
    paso: PostFotosPaso,
    car: PostFotosCarInput,
  ): Promise<string | null> {
    if (!this.openai) {
      throw new Error('OPENAI_API_KEY vacío');
    }

    const result = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: postFotosSystemPrompt(paso) },
        { role: 'user', content: postFotosUserPrompt(car) },
      ],
      temperature: 0.5,
    });

    const content = result.choices[0]?.message?.content?.trim();
    if (!content) {
      this.logger.warn(`El modelo no devolvió texto post-fotos paso=${paso}`);
      return null;
    }
    return flattenPostFotosMessage(content);
  }
}
