import { Inject, Injectable, Logger } from '@nestjs/common';
import { parseCtwaMatch } from './parse-ctwa-match';
import {
  CtwaMatch,
  EnsureLeadResult,
  HandoffBrief,
  HandoffTurn,
  InterestedCarInput,
  InterestedCarSnapshot,
  LeadAnalysisPatch,
  LeadRecoveryPatch,
  LeadRow,
  LeadSignalWrites,
  PersistLeadInput,
  StoppedHandoffInput,
  TradeInInput,
} from './lead.types';
import {
  SUPABASE_GATEWAY,
  SupabaseGateway,
} from './supabase.gateway';
import { phoneForLeadColumn, usablePhone } from './usable-phone';
import { buildChatHistoryRows } from './chat-history';
import { chatRowToMemoryMessage } from './parse-chat-history';
import { MemoryMessage } from '../conversation/conversation.service';
import { RESUMEN_HISTORY_MAX } from '../conversation/build-resumen-input';

export type SyncInboundLeadResult = {
  lead: EnsureLeadResult;
  ctwa: CtwaMatch;
};

@Injectable()
export class PersistenceService {
  private readonly logger = new Logger(PersistenceService.name);

  constructor(
    @Inject(SUPABASE_GATEWAY) private readonly supabase: SupabaseGateway | null,
  ) {}

  async syncInboundLead(input: PersistLeadInput): Promise<SyncInboundLeadResult> {
    const lead = await this.ensureLead(input);
    const storedPhone =
      lead.status === 'created' || lead.status === 'existing'
        ? lead.lead.phone
        : null;
    const phone = usablePhone(input.phone) ?? usablePhone(storedPhone);
    const ctwa = phone
      ? await this.matchCtwa(phone)
      : { matched: false, adHeadline: null, capturedAt: null };

    return { lead, ctwa };
  }

  async ensureLead(input: PersistLeadInput): Promise<EnsureLeadResult> {
    if (!this.supabase || !input.contactId) {
      return { status: 'skipped' };
    }

    try {
      const existing = await this.supabase.findLeadByContactId(input.contactId);
      if (existing) {
        if (input.assignedTo && !existing.assignedTo) {
          await this.supabase.updateLeadAssignee(existing.id, input.assignedTo);
          return {
            status: 'existing',
            lead: { ...existing, assignedTo: input.assignedTo },
          };
        }
        return { status: 'existing', lead: existing };
      }

      const created = await this.supabase.insertLead({
        contactId: input.contactId,
        leadIdKommo: input.leadIdKommo,
        name: input.name.trim() || 'sin nombre',
        phone: phoneForLeadColumn(input.phone),
        source: input.source,
        assignedTo: input.assignedTo,
      });

      if (!created) {
        return { status: 'unavailable' };
      }

      return { status: 'created', lead: created };
    } catch (error) {
      this.logger.error(
        `ensureLead falló contactId=${input.contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return { status: 'unavailable' };
    }
  }

  async matchCtwa(phone: string): Promise<CtwaMatch> {
    if (!this.supabase) {
      return { matched: false, adHeadline: null, capturedAt: null };
    }

    try {
      return parseCtwaMatch(await this.supabase.matchCtwaClick(phone));
    } catch (error) {
      this.logger.error(
        `matchCtwa falló phone=${phone}`,
        error instanceof Error ? error.stack : undefined,
      );
      return { matched: false, adHeadline: null, capturedAt: null };
    }
  }

  async applyLeadWrites(input: {
    contactId: string;
    lead?: LeadRow | null;
    writes: LeadSignalWrites;
  }): Promise<void> {
    if (!this.supabase) {
      return;
    }

    try {
      const lead =
        input.lead?.id
          ? input.lead
          : await this.supabase.findLeadByContactId(input.contactId);

      if (!lead?.id) {
        this.logger.warn(
          `Señales omitidas: no hay lead contactId=${input.contactId}`,
        );
        return;
      }

      if (input.writes.missingData) {
        await this.supabase.insertRequestedClientData({
          leadId: lead.id,
          message: input.writes.missingData.message,
        });
      }

      if (input.writes.financingAdvice) {
        await this.supabase.insertFinancingAdvice({
          leadId: lead.id,
          message: input.writes.financingAdvice.message,
        });
      }

      await this.supabase.updateLeadSignals(lead.id, input.writes.patch);
    } catch (error) {
      this.logger.error(
        `applyLeadWrites falló contactId=${input.contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async saveRecoveryResponse(row: LeadRecoveryPatch): Promise<void> {
    if (!this.supabase) {
      return;
    }

    try {
      await this.supabase.updateLeadRecovery(row);
    } catch (error) {
      this.logger.error(
        `lead_recovery falló lead=${row.leadId} step=${row.step}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async applyLeadAnalysis(input: {
    leadId: string;
    patch: LeadAnalysisPatch;
    tradeIn?: TradeInInput | null;
  }): Promise<void> {
    if (!this.supabase) {
      return;
    }

    if (input.tradeIn) {
      try {
        await this.supabase.insertTradeIn(input.tradeIn);
      } catch (error) {
        this.logger.error(
          `trade_in_cars falló lead=${input.leadId}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (Object.keys(input.patch).length > 0) {
      try {
        await this.supabase.updateLeadAnalysis(input.leadId, input.patch);
      } catch (error) {
        this.logger.error(
          `applyLeadAnalysis falló lead=${input.leadId}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }

  async recordStoppedMessage(input: StoppedHandoffInput): Promise<LeadRow | null> {
    if (!input.text.trim()) {
      return null;
    }

    const ensured = await this.ensureLead(input);
    if (ensured.status !== 'created' && ensured.status !== 'existing') {
      return null;
    }

    const lead = ensured.lead;
    const at = new Date().toISOString();
    const turn = {
      role: input.role,
      name:
        input.role === 'seller' && input.authorName?.trim()
          ? input.authorName.trim()
          : null,
      text: input.text.trim(),
      at,
    };
    const starting = !lead.botApagado;
    const turns = starting ? [turn] : [...(lead.handoffTurns ?? []), turn];

    try {
      await this.supabase?.updateLeadHandoff(lead.id, {
        botApagado: true,
        botApagadoAt: starting ? at : lead.botApagadoAt ?? at,
        ultimoMensajeIgnorado:
          input.role === 'customer'
            ? input.text.trim()
            : lead.ultimoMensajeIgnorado ?? null,
        handoffTurns: turns,
        ...(starting ? { handoffResumen: null } : {}),
      });
    } catch (error) {
      this.logger.error(
        `bot_apagado falló contactId=${input.contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return lead;
    }

    return {
      ...lead,
      botApagado: true,
      botApagadoAt: starting ? at : lead.botApagadoAt ?? at,
      ultimoMensajeIgnorado:
        input.role === 'customer'
          ? input.text.trim()
          : lead.ultimoMensajeIgnorado ?? null,
      handoffTurns: turns,
    };
  }

  /** Si el asesor ya destildó atiende IA?, suelta el tramo y devuelve los turnos. */
  async consumeHandoffTurns(contactId: string): Promise<HandoffTurn[]> {
    if (!this.supabase || !contactId) {
      return [];
    }

    try {
      const lead = await this.supabase.findLeadByContactId(contactId);
      if (!lead?.botApagado) {
        return [];
      }

      const turns = lead.handoffTurns ?? [];
      await this.supabase.updateLeadHandoff(lead.id, {
        botApagado: false,
        botApagadoAt: lead.botApagadoAt ?? null,
        ultimoMensajeIgnorado: lead.ultimoMensajeIgnorado ?? null,
        handoffTurns: turns,
      });
      return turns;
    } catch (error) {
      this.logger.error(
        `consumeHandoff falló contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return [];
    }
  }

  async loadHandoffBrief(contactId: string): Promise<HandoffBrief | null> {
    if (!this.supabase || !contactId) {
      return null;
    }

    try {
      const lead = await this.supabase.findLeadByContactId(contactId);
      if (
        !lead ||
        lead.botApagado ||
        !lead.handoffTurns?.length ||
        lead.handoffResumen
      ) {
        return null;
      }

      return {
        leadId: lead.id,
        turns: lead.handoffTurns,
        resumen: lead.handoffResumen ?? null,
      };
    } catch (error) {
      this.logger.error(
        `loadHandoffBrief falló contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  async saveHandoffResumen(leadId: string, resumen: string): Promise<void> {
    if (!this.supabase || !leadId || !resumen.trim()) {
      return;
    }

    try {
      await this.supabase.updateHandoffResumen(leadId, resumen.trim());
    } catch (error) {
      this.logger.error(
        `handoff_resumen falló lead=${leadId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async assignLead(leadId: string, assignedTo: string | null | undefined): Promise<void> {
    if (!this.supabase || !leadId || !assignedTo) {
      return;
    }

    try {
      await this.supabase.updateLeadAssignee(leadId, assignedTo);
    } catch (error) {
      this.logger.error(
        `assigned_to falló lead=${leadId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async loadRecentChat(contactId: string): Promise<MemoryMessage[]> {
    if (!this.supabase || !contactId) {
      return [];
    }

    try {
      const rows = await this.supabase.listChatHistory(
        contactId,
        RESUMEN_HISTORY_MAX * 2,
      );
      return rows
        .slice()
        .reverse()
        .map((row) => chatRowToMemoryMessage(row.message))
        .filter((item): item is MemoryMessage => Boolean(item))
        .slice(-RESUMEN_HISTORY_MAX);
    } catch (error) {
      this.logger.error(
        `leer n8n_chat_histories falló contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return [];
    }
  }

  async appendChatHistory(input: {
    contactId: string;
    human?: string;
    ai?: string;
  }): Promise<void> {
    if (!this.supabase || !input.contactId) {
      return;
    }

    const rows = buildChatHistoryRows({
      sessionId: input.contactId,
      human: input.human,
      ai: input.ai,
    });
    if (rows.length === 0) {
      return;
    }

    try {
      await this.supabase.insertChatHistory(rows);
    } catch (error) {
      this.logger.error(
        `n8n_chat_histories falló contactId=${input.contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async latestInterestedCar(
    contactId: string,
  ): Promise<InterestedCarSnapshot | null> {
    if (!this.supabase || !contactId) {
      return null;
    }

    try {
      const lead = await this.supabase.findLeadByContactId(contactId);
      if (!lead) {
        return null;
      }
      return await this.supabase.latestInterestedCar(lead.id);
    } catch (error) {
      this.logger.error(
        `interested_cars último falló contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  async saveInterestedCar(row: InterestedCarInput): Promise<void> {
    if (!this.supabase) {
      return;
    }

    try {
      if (await this.supabase.hasInterestedCar(row.leadId, row.inventoryId)) {
        return;
      }
      await this.supabase.insertInterestedCar(row);
    } catch (error) {
      this.logger.error(
        `interested_cars falló lead=${row.leadId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
