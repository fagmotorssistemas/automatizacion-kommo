import { Inject, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  OPENAI_AGENT_CONFIG,
  type OpenAiAgentConfig,
} from '../agent/openai-agent.config';
import { ANALYSIS_SYSTEM_PROMPT } from './analysis.prompt';
import { OBJECION_TIPOS } from './objecion';
import {
  ConversationReading,
  parseConversationReading,
} from './parse-analysis';

const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'objecion_principal',
    'objecion_texto',
    'objecion_evidencia',
    'agendo_visita',
    'resumen',
    'presupuesto_declarado',
    'presupuesto_monto',
    'entrada_disponible',
    'forma_pago',
    'seguimiento',
  ],
  properties: {
    objecion_principal: {
      type: ['string', 'null'],
      enum: [...OBJECION_TIPOS, null],
    },
    objecion_texto: { type: 'string' },
    objecion_evidencia: { type: 'string' },
    agendo_visita: { type: 'boolean' },
    resumen: { type: 'string' },
    presupuesto_declarado: { type: 'string' },
    presupuesto_monto: { type: ['number', 'null'] },
    entrada_disponible: { type: ['number', 'null'] },
    forma_pago: { type: ['string', 'null'], enum: ['contado', 'credito', null] },
    seguimiento: {
      type: 'string',
      enum: ['activo', 'aplazado', 'cerrado'],
    },
  },
} as const;

@Injectable()
export class AnalysisLlmClient {
  private readonly logger = new Logger(AnalysisLlmClient.name);
  private readonly openai: OpenAI | null;
  private readonly model: string;

  constructor(@Inject(OPENAI_AGENT_CONFIG) config: OpenAiAgentConfig) {
    this.openai = config.apiKey ? new OpenAI({ apiKey: config.apiKey }) : null;
    this.model = config.model;
  }

  isReady(): boolean {
    return this.openai !== null;
  }

  async read(transcript: string): Promise<ConversationReading | null> {
    if (!this.openai) {
      throw new Error('OPENAI_API_KEY vacío');
    }

    const text = transcript.trim();
    if (!text) {
      return null;
    }

    const result = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: text.slice(0, 24000) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'lead_conversation_analysis',
          strict: true,
          schema: ANALYSIS_SCHEMA,
        },
      },
    });

    const content = result.choices[0]?.message?.content;
    if (!content) {
      this.logger.warn('El modelo no devolvió contenido');
      return null;
    }

    try {
      return parseConversationReading(JSON.parse(content));
    } catch (error) {
      this.logger.warn(
        `JSON de análisis inválido: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }
}
