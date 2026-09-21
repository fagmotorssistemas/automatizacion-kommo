import { Inject, Injectable, Logger } from '@nestjs/common';
import { parseCtwaMatch } from './parse-ctwa-match';
import {
  CtwaMatch,
  EnsureLeadResult,
  InterestedCarInput,
  LeadAnalysisPatch,
  LeadRecoveryPatch,
  LeadRow,
  LeadSignalWrites,
  PersistLeadInput,
  TradeInInput,
} from './lead.types';
import {
  SUPABASE_GATEWAY,
  SupabaseGateway,
} from './supabase.gateway';
import { phoneForLeadColumn, usablePhone } from './usable-phone';

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

    try {
      if (input.tradeIn) {
        await this.supabase.insertTradeIn(input.tradeIn);
      }
      if (Object.keys(input.patch).length > 0) {
        await this.supabase.updateLeadAnalysis(input.leadId, input.patch);
      }
    } catch (error) {
      this.logger.error(
        `applyLeadAnalysis falló lead=${input.leadId}`,
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
        `interested_cars falló lead=${row.leadId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
