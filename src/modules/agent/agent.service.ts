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
import { formatHandoffTurnsForSummarizer } from '../persistence/format-handoff-turns';
import { PersistenceService } from '../persistence/persistence.service';
import { buildResumenInput } from '../conversation/build-resumen-input';
import { isRealCustomerText } from '../conversation/is-real-customer-text';
import { INTENTS_SYSTEM_PROMPT } from './prompts/intents.prompt';
import { HANDOFF_SUMMARIZER_SYSTEM_PROMPT } from './prompts/handoff-summarizer.prompt';
import { RESUMEN_SYSTEM_PROMPT } from './prompts/resumen.prompt';
import { salesSystemPrompt } from './prompts/sales.prompt';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly openai: OpenAiAgentClient,
    private readonly catalog: CatalogService,
    private readonly conversation: ConversationService,
    private readonly persistence: PersistenceService,
  ) {}

  async handleTurn(input: {
    contactId: string;
    customerText: string;
  }): Promise<AgentTurnResult | null> {
    if (!isRealCustomerText(input.customerText)) {
      return null;
    }

    if (!this.openai.isReady()) {
      throw new Error('OPENAI_API_KEY vacío; no se llama al modelo');
    }

    const history = await this.recentDialogue(input.contactId);
    const handoffBrief = await this.attachHandoffBrief(
      input.contactId,
      history,
    );
    await this.conversation.appendMessage(input.contactId, {
      role: 'user',
      content: input.customerText,
    });

    const resumenInput = buildResumenInput({
      history,
      customerText: input.customerText,
      handoffBrief,
    });
    const resumen =
      (await this.openai.complete(RESUMEN_SYSTEM_PROMPT, resumenInput)) ??
      input.customerText;

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

    await this.persistence.appendChatHistory({
      contactId: input.contactId,
      human: input.customerText,
      ai: parsed.mensaje,
    });

    this.logger.log(
      `Agente listo contactId=${input.contactId} inventory=${parsed.meta.vehiculo?.inventory_id ?? 'ninguno'}`,
    );

    return { reply: parsed, resumen };
  }

  private async recentDialogue(contactId: string) {
    const live = await this.conversation.recentMessages(contactId);
    if (live.length > 0) {
      return live;
    }
    return this.persistence.loadRecentChat(contactId);
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

  private async attachHandoffBrief(
    contactId: string,
    history: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<string | null> {
    const existing = history.find((item) =>
      item.content.startsWith('CONTEXTO ASESOR'),
    );
    if (existing) {
      return existing.content.replace(/^CONTEXTO ASESOR \(bot estuvo apagado\):\n?/, '');
    }

    const brief = await this.persistence.loadHandoffBrief(contactId);
    if (!brief) {
      return null;
    }

    const crudo = formatHandoffTurnsForSummarizer(brief.turns);
    let resumen =
      brief.resumen ??
      (await this.openai.complete(HANDOFF_SUMMARIZER_SYSTEM_PROMPT, crudo));
    if (!resumen) {
      resumen = crudo;
    }
    await this.persistence.saveHandoffResumen(brief.leadId, resumen);

    const content = `CONTEXTO ASESOR (bot estuvo apagado):\n${resumen}`;
    history.unshift({ role: 'assistant', content });
    await this.conversation.appendMessage(contactId, {
      role: 'assistant',
      content,
    });
    this.logger.log(`Handoff masticado contactId=${contactId}`);
    return resumen;
  }
}
