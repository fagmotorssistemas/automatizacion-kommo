import {
  InterestedCarInput,
  LeadAnalysisPatch,
  LeadRecoveryPatch,
  LeadRow,
  LeadSignalPatch,
  RequestedClientDataInput,
  TradeInInput,
} from './lead.types';

export const SUPABASE_GATEWAY = 'SUPABASE_GATEWAY';

export type LeadInsert = {
  contactId: string;
  leadIdKommo: string;
  name: string;
  phone: string;
  source: string;
};

export type AgentPromptRow = {
  name: string;
  content: string;
};

export type SupabaseGateway = {
  findLeadByContactId(contactId: string): Promise<LeadRow | null>;
  insertLead(row: LeadInsert): Promise<LeadRow | null>;
  matchCtwaClick(phone: string): Promise<unknown>;
  fetchAgentPrompts(names: string[]): Promise<AgentPromptRow[]>;
  matchInventory(embedding: number[], topK: number): Promise<unknown>;
  findPhotoBots(input: {
    inventoryId?: string;
    prefixes: string[];
  }): Promise<number[]>;
  hasInterestedCar(leadId: string, inventoryId: string): Promise<boolean>;
  insertInterestedCar(row: InterestedCarInput): Promise<void>;
  updateLeadSignals(leadId: string, patch: LeadSignalPatch): Promise<void>;
  insertRequestedClientData(row: RequestedClientDataInput): Promise<void>;
  insertFinancingAdvice(row: RequestedClientDataInput): Promise<void>;
  updateLeadRecovery(row: LeadRecoveryPatch): Promise<void>;
  updateLeadAnalysis(leadId: string, patch: LeadAnalysisPatch): Promise<void>;
  insertTradeIn(row: TradeInInput): Promise<void>;
  insertRunLog(row: {
    created_at: string;
    contact_id: string | null;
    lead_id: string | null;
    message_id: string | null;
    step: string;
    status: string;
    reason: string | null;
    detail: Record<string, unknown>;
    error: string | null;
  }): Promise<void>;
};
