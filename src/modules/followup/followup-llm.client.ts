import { Inject, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  OPENAI_AGENT_CONFIG,
  type OpenAiAgentConfig,
} from '../agent/openai-agent.config';
import type { RetomaNumero } from './followup.constants';
import { FOLLOWUP_SYSTEM_PROMPT, followupUserPrompt } from './followup.prompt';

export type FollowupDraftInput = {
  retoma: RetomaNumero;
  resumen: string;
  vehiculos: string[];
  objecion: string | null;
  objecionTexto: string | null;
  objecionEvidencia: string | null;
  presupuesto: string | null;
};

@Injectable()
export class FollowupLlmClient {
  private readonly logger = new Logger(FollowupLlmClient.name);
  private readonly openai: OpenAI | null;
  private readonly model: string;

  constructor(@Inject(OPENAI_AGENT_CONFIG) config: OpenAiAgentConfig) {
    this.openai = config.apiKey ? new OpenAI({ apiKey: config.apiKey }) : null;
    this.model = config.model;
  }

  isReady(): boolean {
    return this.openai !== null;
  }

  async draft(input: FollowupDraftInput): Promise<string | null> {
    if (!this.openai) {
      throw new Error('OPENAI_API_KEY vacío');
    }

    const result = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: FOLLOWUP_SYSTEM_PROMPT },
        { role: 'user', content: followupUserPrompt(input) },
      ],
      temperature: 0.4,
    });

    const content = result.choices[0]?.message?.content?.trim();
    if (!content) {
      this.logger.warn('El modelo no devolvió texto de retoma');
      return null;
    }
    return content;
  }
}
