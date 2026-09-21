import {
  HandoffTurn,
  InterestedCarInput,
  LeadAnalysisPatch,
  LeadRecoveryPatch,
  LeadRow,
  LeadSignalPatch,
  RequestedClientDataInput,
  TradeInInput,
} from './lead.types';

export type LeadHandoffPatch = {
  botApagado: boolean;
  botApagadoAt: string | null;
  ultimoMensajeIgnorado: string | null;
  handoffTurns: HandoffTurn[];
  handoffResumen?: string | null;
};

export const SUPABASE_GATEWAY = 'SUPABASE_GATEWAY';

export type LeadInsert = {
  contactId: string;
  leadIdKommo: string;
  name: string;
  phone: string;
  source: string;
  assignedTo?: string | null;
};

export type AgentPromptRow = {
  name: string;
  content: string;
};

export type SupabaseGateway = {
  findLeadByContactId(contactId: string): Promise<LeadRow | null>;
  insertLead(row: LeadInsert): Promise<LeadRow | null>;
  updateLeadAssignee(leadId: string, assignedTo: string): Promise<void>;
  updateLeadHandoff(leadId: string, patch: LeadHandoffPatch): Promise<void>;
  updateHandoffResumen(leadId: string, resumen: string): Promise<void>;
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
  insertChatHistory(rows: Array<{
    session_id: string;
    message: Record<string, unknown>;
  }>): Promise<void>;
  listChatHistory(
    sessionId: string,
    limit: number,
  ): Promise<Array<{ message: unknown }>>;
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
