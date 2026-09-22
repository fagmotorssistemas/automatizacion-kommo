import { Injectable, Logger } from '@nestjs/common';
import { OpenAiAgentClient } from '../agent/openai-agent.client';
import { ParsedAgentOutput } from '../agent/parse-agent-output';
import { LEAD_ANALYZER_SYSTEM_PROMPT } from '../agent/prompts/lead-analyzer.prompt';
import { ConversationService } from '../conversation/conversation.service';
import {
  isRealCustomerText,
  keepCustomerFacingMessages,
} from '../conversation/is-real-customer-text';
import { LeadRow } from '../persistence/lead.types';
import { PersistenceService } from '../persistence/persistence.service';
import { analyzeTurn, TurnSignals } from './analyze-turn';
import { planRecoveryWrite } from './classify-recovery-response';
import { planLeadSignalWrites } from './lead-signal-writes';
import {
  leadAnalyzerUserPrompt,
  parseLeadAnalysis,
} from './parse-lead-analysis';
import { planLeadAnalysisWrites } from './plan-lead-analysis-writes';

export type AfterReplySignals = TurnSignals & {
  mensajes: { type: string; content: string }[];
};

@Injectable()
export class IntelligenceService {
  private readonly logger = new Logger(IntelligenceService.name);

  constructor(
    private readonly conversation: ConversationService,
    private readonly persistence: PersistenceService,
    private readonly openai: OpenAiAgentClient,
  ) {}

  async afterReply(input: {
    contactId: string;
    leadId: string;
    lead?: LeadRow | null;
    customerText: string;
    resumen: string;
    reply: ParsedAgentOutput;
  }): Promise<AfterReplySignals> {
    const customerText = isRealCustomerText(input.customerText)
      ? input.customerText
      : '';
    const signals = analyzeTurn({
      leadId: input.leadId,
      mensaje: input.reply.mensaje,
      resumen: input.resumen,
      customerText,
      inventoryId: input.reply.meta.vehiculo?.inventory_id,
      imgPrefix: input.reply.img_prefix,
    });

    const recent = await this.conversation.recentMessages(input.contactId);
    const mensajes = keepCustomerFacingMessages(recent)
      .slice(-3)
      .map((item) => ({
        type: item.role === 'user' ? 'human' : 'ai',
        content: item.content,
      }));

    if (signals.vehicleUid && signals.inventoryId && input.lead?.id) {
      await this.persistence.saveInterestedCar({
        leadId: input.lead.id,
        inventoryId: signals.inventoryId,
        vehicleUid: signals.vehicleUid,
      });
    }
    const recovery = planRecoveryWrite({
      mensajesEnviados: input.lead?.mensajesEnviados,
      message: customerText,
    });
    if (recovery && input.lead?.id) {
      await this.persistence.saveRecoveryResponse({
        leadId: input.lead.id,
        step: recovery.step,
        response: recovery.classification.value,
        responseText: recovery.textRaw,
        stop: recovery.classification.stop,
      });
    }

    await this.persistence.applyLeadWrites({
      contactId: input.contactId,
      lead: input.lead,
      writes: planLeadSignalWrites(signals),
    });

    if (input.lead?.id && customerText) {
      await this.enrichFromAnalyzer({
        lead: input.lead,
        customerText,
        agentMessage: input.reply.mensaje,
      });
    }

    this.logger.log(
      `Señales lead=${input.leadId} uid=${signals.vehicleUid ?? 'ninguno'} handoff=${signals.requiereAtencionVendedor} llamada=${signals.quiereLlamada}`,
    );

    return { ...signals, mensajes };
  }

  private async enrichFromAnalyzer(input: {
    lead: LeadRow;
    customerText: string;
    agentMessage: string;
  }): Promise<void> {
    if (!this.openai.isReady()) {
      return;
    }

    try {
      const raw = await this.openai.complete(
        LEAD_ANALYZER_SYSTEM_PROMPT,
        leadAnalyzerUserPrompt(input.agentMessage, input.customerText),
      );
      const analysis = parseLeadAnalysis(raw);
      if (!analysis) {
        return;
      }

      const writes = planLeadAnalysisWrites({
        leadId: input.lead.id,
        analysis,
        oldSignals: input.lead.behaviorSignals,
      });

      await this.persistence.applyLeadAnalysis({
        leadId: input.lead.id,
        patch: writes.patch,
        tradeIn: writes.tradeIn,
      });
    } catch (error) {
      this.logger.error(
        `Analizador falló lead=${input.lead.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
