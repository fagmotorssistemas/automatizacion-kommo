import { Inject, Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import {
  InterestedCarInput,
  LeadAnalysisPatch,
  LeadRecoveryPatch,
  LeadRow,
  LeadSignalPatch,
  RequestedClientDataInput,
  TradeInInput,
} from './lead.types';
import { LeadInsert, SupabaseGateway } from './supabase.gateway';
import { SUPABASE_CONFIG, type SupabaseConfig } from './supabase.config';

const LEAD_COLUMNS =
  'id, contact_id, lead_id_kommo, name, phone, source, assigned_to, mensajes_enviados, behavior_signals';

@Injectable()
export class SupabasePersistenceClient implements SupabaseGateway {
  private readonly logger = new Logger(SupabasePersistenceClient.name);
  private readonly client: SupabaseClient | null;

  constructor(@Inject(SUPABASE_CONFIG) config: SupabaseConfig) {
    this.client =
      config.url && config.serviceRoleKey
        ? createClient(config.url, config.serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
            // Node 20 no trae WebSocket nativo; Supabase Realtime lo exige al instanciar.
            realtime: { transport: ws as unknown as typeof WebSocket },
          })
        : null;
  }

  async findLeadByContactId(contactId: string): Promise<LeadRow | null> {
    const client = this.requireClient();
    if (!client) {
      return null;
    }

    const { data, error } = await client
      .from('leads')
      .select(LEAD_COLUMNS)
      .eq('contact_id', contactId)
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.warn(`GET leads contact_id=${contactId}: ${error.message}`);
      throw error;
    }

    return data ? this.mapLead(data) : null;
  }

  async insertLead(row: LeadInsert): Promise<LeadRow | null> {
    const client = this.requireClient();
    if (!client) {
      return null;
    }

    const { data, error } = await client
      .from('leads')
      .insert({
        contact_id: row.contactId,
        lead_id_kommo: row.leadIdKommo,
        name: row.name,
        phone: row.phone,
        source: row.source,
      })
      .select(LEAD_COLUMNS)
      .single();

    if (error) {
      this.logger.warn(`INSERT leads contact_id=${row.contactId}: ${error.message}`);
      throw error;
    }

    return data ? this.mapLead(data) : null;
  }

  async matchCtwaClick(phone: string): Promise<unknown> {
    const client = this.requireClient();
    if (!client) {
      return null;
    }

    const { data, error } = await client.rpc('fn_match_lead_to_ctwa_click', {
      p_phone: phone,
    });

    if (error) {
      this.logger.warn(`RPC fn_match_lead_to_ctwa_click: ${error.message}`);
      throw error;
    }

    return data;
  }

  async fetchAgentPrompts(names: string[]): Promise<{ name: string; content: string }[]> {
    const client = this.requireClient();
    if (!client || names.length === 0) {
      return [];
    }

    const { data, error } = await client
      .from('agent_prompts')
      .select('name,content')
      .in('name', names);

    if (error) {
      this.logger.warn(`GET agent_prompts: ${error.message}`);
      throw error;
    }

    return (data ?? []).map((row) => ({
      name: String(row.name ?? ''),
      content: String(row.content ?? ''),
    }));
  }

  async matchInventory(embedding: number[], topK: number): Promise<unknown> {
    const client = this.requireClient();
    if (!client) {
      return [];
    }

    const { data, error } = await client.rpc('match_inventoryoracle', {
      query_embedding: embedding,
      match_count: topK,
    });

    if (error) {
      this.logger.warn(`RPC match_inventoryoracle: ${error.message}`);
      throw error;
    }

    return data;
  }

  async findPhotoBots(input: {
    inventoryId?: string;
    prefixes: string[];
  }): Promise<number[]> {
    const client = this.requireClient();
    if (!client) {
      return [];
    }

    const ids = new Set<number>();

    const addBots = (rows: Array<{ bot_id?: unknown }> | null) => {
      for (const row of rows ?? []) {
        const botId = Number(row.bot_id);
        if (Number.isFinite(botId) && botId > 0) {
          ids.add(botId);
        }
      }
    };

    if (input.inventoryId) {
      const { data, error } = await client
        .from('inventoryoracle')
        .select('bot_id')
        .eq('id', input.inventoryId)
        .maybeSingle();

      if (error) {
        this.logger.warn(`GET inventoryoracle bot_id: ${error.message}`);
        throw error;
      }

      addBots(data ? [data] : []);
    }

    if (ids.size === 0 && input.prefixes.length > 0) {
      const { data, error } = await client
        .from('inventoryoracle')
        .select('bot_id')
        .in('img_prefix', input.prefixes)
        .not('bot_id', 'is', null);

      if (error) {
        this.logger.warn(`GET inventoryoracle bot_id por prefix: ${error.message}`);
        throw error;
      }

      addBots(data);
    }

    return [...ids].slice(0, 4);
  }

  async hasInterestedCar(leadId: string, inventoryId: string): Promise<boolean> {
    const client = this.requireClient();
    if (!client) {
      return false;
    }

    const { data, error } = await client
      .from('interested_cars')
      .select('id')
      .eq('lead_id', leadId)
      .eq('inventory_id', inventoryId)
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.warn(`GET interested_cars: ${error.message}`);
      throw error;
    }

    return Boolean(data);
  }

  async insertInterestedCar(row: InterestedCarInput): Promise<void> {
    const client = this.requireClient();
    if (!client) {
      return;
    }

    const { error } = await client.from('interested_cars').insert({
      lead_id: row.leadId,
      inventory_id: row.inventoryId,
      vehicle_uid: row.vehicleUid,
    });

    if (error) {
      this.logger.warn(`INSERT interested_cars: ${error.message}`);
      throw error;
    }
  }

  async updateLeadSignals(leadId: string, patch: LeadSignalPatch): Promise<void> {
    const client = this.requireClient();
    if (!client) {
      return;
    }

    const { error } = await client.from('leads').update(patch).eq('id', leadId);

    if (error) {
      this.logger.warn(`UPDATE leads id=${leadId}: ${error.message}`);
      throw error;
    }
  }

  async insertRequestedClientData(row: RequestedClientDataInput): Promise<void> {
    const client = this.requireClient();
    if (!client) {
      return;
    }

    const { error } = await client.from('datos_solicitados_clientes').insert({
      lead_id: row.leadId,
      mensaje_completo: row.message,
    });

    if (error) {
      this.logger.warn(`INSERT datos_solicitados_clientes: ${error.message}`);
      throw error;
    }
  }

  async updateLeadRecovery(row: LeadRecoveryPatch): Promise<void> {
    const client = this.requireClient();
    if (!client) {
      return;
    }

    const { error } = await client
      .from('lead_recovery')
      .update({
        [`response_${row.step}`]: row.response,
        [`response_${row.step}_text`]: row.responseText,
        stop: row.stop,
      })
      .eq('lead_id', row.leadId);

    if (error) {
      this.logger.warn(`UPDATE lead_recovery lead=${row.leadId}: ${error.message}`);
      throw error;
    }
  }

  async updateLeadAnalysis(leadId: string, patch: LeadAnalysisPatch): Promise<void> {
    const client = this.requireClient();
    if (!client || Object.keys(patch).length === 0) {
      return;
    }

    const { error } = await client.from('leads').update(patch).eq('id', leadId);

    if (error) {
      this.logger.warn(`UPDATE leads analysis id=${leadId}: ${error.message}`);
      throw error;
    }
  }

  async insertTradeIn(row: TradeInInput): Promise<void> {
    const client = this.requireClient();
    if (!client) {
      return;
    }

    const { error } = await client.from('trade_in_cars').insert({
      lead_id: row.leadId,
      brand: row.brand,
      model: row.model,
      year: row.year,
      condition: 'bueno',
    });

    if (error) {
      this.logger.warn(`INSERT trade_in_cars: ${error.message}`);
      throw error;
    }
  }

  async insertFinancingAdvice(row: RequestedClientDataInput): Promise<void> {
    const client = this.requireClient();
    if (!client) {
      return;
    }

    const { error } = await client.from('asesoria_financiamiento').insert({
      lead_id: row.leadId,
      mensaje_completo: row.message,
    });

    if (error) {
      this.logger.warn(`INSERT asesoria_financiamiento: ${error.message}`);
      throw error;
    }
  }

  async insertRunLog(row: {
    created_at: string;
    contact_id: string | null;
    lead_id: string | null;
    message_id: string | null;
    step: string;
    status: string;
    reason: string | null;
    detail: Record<string, unknown>;
    error: string | null;
  }): Promise<void> {
    const client = this.requireClient();
    if (!client) {
      return;
    }

    const { error } = await client.from('automation_run_logs').insert(row);
    if (error) {
      this.logger.warn(`INSERT automation_run_logs: ${error.message}`);
    }
  }

  private requireClient(): SupabaseClient | null {
    if (!this.client) {
      this.logger.warn('Supabase sin URL o service role en .env; no se llama');
    }
    return this.client;
  }

  private mapLead(row: Record<string, unknown>): LeadRow {
    return {
      id: String(row.id ?? ''),
      contactId: String(row.contact_id ?? ''),
      leadIdKommo: String(row.lead_id_kommo ?? ''),
      name: String(row.name ?? ''),
      phone: String(row.phone ?? ''),
      source: String(row.source ?? ''),
      mensajesEnviados: Array.isArray(row.mensajes_enviados)
        ? row.mensajes_enviados.map(String)
        : [],
      behaviorSignals:
        row.behavior_signals && typeof row.behavior_signals === 'object'
          ? (row.behavior_signals as LeadRow['behaviorSignals'])
          : {},
    };
  }
}
