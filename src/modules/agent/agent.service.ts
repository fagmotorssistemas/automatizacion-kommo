import { Injectable, Logger } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { ConversationService } from '../conversation/conversation.service';
import { getDealershipClock } from '../intelligence/dealership-hours';
import {
  calcularFinanciamiento,
  calcularFinanciamientoBancario,
  FinanciamientoInput,
} from '../intelligence/financiamiento';
import {
  assembleDynamicContext,
  parseIntentsPayload,
  promptNamesFromIntents,
} from './assemble-dynamic-context';
import { OpenAiAgentClient } from './openai-agent.client';
import { AgentTurnResult, parseAgentOutput } from './parse-agent-output';
import { INTENTS_SYSTEM_PROMPT } from './prompts/intents.prompt';
import { RESUMEN_SYSTEM_PROMPT } from './prompts/resumen.prompt';
import { salesSystemPrompt } from './prompts/sales.prompt';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly openai: OpenAiAgentClient,
    private readonly catalog: CatalogService,
    private readonly conversation: ConversationService,
  ) {}

  async handleTurn(input: {
    contactId: string;
    customerText: string;
  }): Promise<AgentTurnResult | null> {
    if (!input.customerText.trim()) {
      return null;
    }

    if (!this.openai.isReady()) {
      throw new Error('OPENAI_API_KEY vacío; no se llama al modelo');
    }

    const history = await this.conversation.recentMessages(input.contactId);
    await this.conversation.appendMessage(input.contactId, {
      role: 'user',
      content: input.customerText,
    });

    const resumen =
      (await this.openai.complete(
        RESUMEN_SYSTEM_PROMPT,
        input.customerText,
      )) ?? input.customerText;

    const intentsRaw =
      (await this.openai.complete(INTENTS_SYSTEM_PROMPT, resumen)) ?? '{}';
    const promptNames = promptNamesFromIntents(parseIntentsPayload(intentsRaw));
    const sections = await this.catalog.fetchAgentPrompts(promptNames);
    const system = salesSystemPrompt(
      getDealershipClock(),
      assembleDynamicContext(sections),
    );

    const raw = await this.openai.runSalesAgent({
      system,
      user: resumen,
      history,
      executeTool: (name, argsJson) => this.executeTool(name, argsJson),
    });

    if (!raw) {
      throw new Error('El agente de ventas no devolvió texto');
    }

    const parsed = parseAgentOutput(raw);
    if (parsed.mensaje) {
      await this.conversation.appendMessage(input.contactId, {
        role: 'assistant',
        content: parsed.mensaje,
      });
    }

    this.logger.log(
      `Agente listo contactId=${input.contactId} inventory=${parsed.meta.vehiculo?.inventory_id ?? 'ninguno'}`,
    );

    return { reply: parsed, resumen };
  }

  private async executeTool(name: string, argsJson: string): Promise<string> {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(argsJson || '{}') as Record<string, unknown>;
    } catch {
      return JSON.stringify({ error: true, mensaje: 'Argumentos inválidos' });
    }

    if (name === 'buscarvehiuclo') {
      const query = String(args.query ?? '').trim();
      const embedding = await this.openai.embed(query);
      return this.catalog.searchInventory(embedding ?? []);
    }

    if (name === 'calcular_financiamiento') {
      return calcularFinanciamiento(args as FinanciamientoInput);
    }

    if (name === 'calcular_financiamiento_bancario') {
      return calcularFinanciamientoBancario(args as FinanciamientoInput);
    }

    return JSON.stringify({ error: true, mensaje: `Tool desconocida: ${name}` });
  }
}
