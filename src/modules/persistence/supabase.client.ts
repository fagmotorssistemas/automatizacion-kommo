import { Inject, Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import {
  InterestedCarInput,
  InterestedCarSnapshot,
  LeadAnalysisPatch,
  LeadRecoveryPatch,
  LeadRow,
  LeadSignalPatch,
  RequestedClientDataInput,
  TradeInInput,
} from './lead.types';
import { isUuid } from './is-uuid';
import { parseHandoffTurns } from './parse-handoff-turns';
import {
  coerceTradeInYear,
  sanitizeLeadAnalysisPatch,
} from './sanitize-lead-analysis';
import {
  LeadHandoffPatch,
  LeadInsert,
  SupabaseGateway,
} from './supabase.gateway';
import { SUPABASE_CONFIG, type SupabaseConfig } from './supabase.config';

function mapStockRow(row: {
  id?: unknown;
  brand?: unknown;
  model?: unknown;
  year?: unknown;
  price?: unknown;
  type_body?: unknown;
  color?: unknown;
  version?: unknown;
  mileage?: unknown;
  transmission?: unknown;
  fuel_type?: unknown;
  passenger_capacity?: unknown;
  doors_count?: unknown;
  drive_type?: unknown;
  vin?: unknown;
}) {
  const text = (value: unknown) =>
    value == null || value === '' ? null : String(value);
  const num = (value: unknown) => (value == null ? null : Number(value));
  return {
    id: String(row.id ?? ''),
    brand: String(row.brand ?? ''),
    model: String(row.model ?? ''),
    year: num(row.year),
    price: num(row.price),
    typeBody: text(row.type_body),
    color: text(row.color),
    version: text(row.version),
    mileage: num(row.mileage),
    transmission: text(row.transmission),
    fuelType: text(row.fuel_type),
    passengerCapacity: text(row.passenger_capacity),
    doorsCount: num(row.doors_count),
    driveType: text(row.drive_type),
    vin: text(row.vin),
  };
}

const LEAD_COLUMNS =
  'id, contact_id, lead_id_kommo, name, phone, source, assigned_to, mensajes_enviados, behavior_signals, bot_apagado, bot_apagado_at, ultimo_mensaje_ignorado, handoff_transcript, handoff_resumen';

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
        assigned_to: row.assignedTo || null,
      })
      .select(LEAD_COLUMNS)
      .single();

    if (error) {
      this.logger.warn(`INSERT leads contact_id=${row.contactId}: ${error.message}`);
      throw error;
    }

    return data ? this.mapLead(data) : null;
  }

  async updateLeadHandoff(leadId: string, patch: LeadHandoffPatch): Promise<void> {
    const client = this.requireClient();
    if (!client || !leadId) {
      return;
    }

    const { error } = await client
      .from('leads')
      .update({
        bot_apagado: patch.botApagado,
        bot_apagado_at: patch.botApagadoAt,
        ultimo_mensaje_ignorado: patch.ultimoMensajeIgnorado,
        handoff_transcript: patch.handoffTurns,
        ...(patch.handoffResumen !== undefined
          ? { handoff_resumen: patch.handoffResumen }
          : {}),
      })
      .eq('id', leadId);

    if (error) {
      this.logger.warn(`UPDATE leads handoff id=${leadId}: ${error.message}`);
      throw error;
    }
  }

  async updateHandoffResumen(leadId: string, resumen: string): Promise<void> {
    const client = this.requireClient();
    if (!client || !leadId || !resumen) {
      return;
    }

    const { error } = await client
      .from('leads')
      .update({ handoff_resumen: resumen })
      .eq('id', leadId);

    if (error) {
      this.logger.warn(`UPDATE leads handoff_resumen id=${leadId}: ${error.message}`);
      throw error;
    }
  }

  async updateLeadAssignee(leadId: string, assignedTo: string): Promise<void> {
    const client = this.requireClient();
    if (!client || !leadId || !assignedTo) {
      return;
    }

    const { error } = await client
      .from('leads')
      .update({ assigned_to: assignedTo })
      .eq('id', leadId);

    if (error) {
      this.logger.warn(`UPDATE leads assigned_to id=${leadId}: ${error.message}`);
      throw error;
    }
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

  async listAvailableExcept(brand: string) {
    const client = this.requireClient();
    if (!client || !brand.trim()) {
      return [];
    }

    const { data, error } = await client
      .from('inventoryoracle')
      .select(
        'id, brand, model, year, price, type_body, color, version, mileage, transmission, fuel_type, passenger_capacity, doors_count, drive_type, vin',
      )
      .eq('status', 'disponible')
      .neq('brand', brand.trim().toLowerCase())
      .order('price', { ascending: true });

    if (error) {
      this.logger.warn(`GET inventoryoracle otras marcas: ${error.message}`);
      throw error;
    }

    return (data ?? []).map((row) => mapStockRow(row));
  }

  async listAvailableByBrand(brand: string): Promise<
    {
      id: string;
      brand: string;
      model: string;
      year: number | null;
      price: number | null;
      typeBody: string | null;
      color: string | null;
      version: string | null;
      mileage: number | null;
      transmission: string | null;
      fuelType: string | null;
      passengerCapacity: string | null;
      doorsCount: number | null;
      driveType: string | null;
      vin: string | null;
    }[]
  > {
    const client = this.requireClient();
    if (!client || !brand.trim()) {
      return [];
    }

    const { data, error } = await client
      .from('inventoryoracle')
      .select(
        'id, brand, model, year, price, type_body, color, version, mileage, transmission, fuel_type, passenger_capacity, doors_count, drive_type, vin',
      )
      .eq('status', 'disponible')
      .ilike('brand', brand.trim())
      .order('price', { ascending: true });

    if (error) {
      this.logger.warn(`GET inventoryoracle marca: ${error.message}`);
      throw error;
    }

    return (data ?? []).map((row) => mapStockRow(row));
  }

  async matchInventory(
    embedding: number[],
    topK: number,
    filter?: { tipo?: string; marca?: string },
  ): Promise<unknown> {
    const client = this.requireClient();
    if (!client) {
      return [];
    }

    const payload: { tipo?: string; marca?: string } = {};
    if (filter?.tipo) {
      payload.tipo = filter.tipo;
    }
    if (filter?.marca) {
      payload.marca = filter.marca;
    }

    const { data, error } = await client.rpc('match_inventoryoracle', {
      query_embedding: embedding,
      match_count: topK,
      filter: payload,
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

    const prefixes = [...input.prefixes];
    const rawId = input.inventoryId?.trim() ?? '';

    if (rawId && isUuid(rawId)) {
      const { data, error } = await client
        .from('inventoryoracle')
        .select('bot_id, img_prefix')
        .eq('id', rawId)
        .maybeSingle();

      if (error) {
        this.logger.warn(`GET inventoryoracle bot_id: ${error.message}`);
      } else {
        addBots(data ? [data] : []);
        const prefix = data?.img_prefix;
        if (ids.size === 0 && typeof prefix === 'string' && prefix.trim()) {
          prefixes.push(prefix.trim());
        }
      }
    } else if (rawId) {
      // El LLM a veces manda slug/img_prefix en vez de uuid.
      prefixes.push(rawId);
    }

    if (ids.size === 0 && prefixes.length > 0) {
      const { data, error } = await client
        .from('inventoryoracle')
        .select('bot_id')
        .in('img_prefix', prefixes)
        .not('bot_id', 'is', null);

      if (error) {
        this.logger.warn(
          `GET inventoryoracle bot_id por prefix: ${error.message}`,
        );
      } else {
        addBots(data);
      }
    }

    return [...ids].slice(0, 4);
  }

  /** Resuelve uuid de inventario; si viene slug, intenta img_prefix. */
  async resolveInventoryId(raw: string): Promise<string | null> {
    const client = this.requireClient();
    const value = raw.trim();
    if (!client || !value) {
      return null;
    }
    if (isUuid(value)) {
      return value;
    }

    const { data, error } = await client
      .from('inventoryoracle')
      .select('id')
      .eq('img_prefix', value)
      .maybeSingle();

    if (error) {
      this.logger.warn(`resolveInventoryId: ${error.message}`);
      return null;
    }
    return data?.id ? String(data.id) : null;
  }

  async hasInterestedCar(leadId: string, inventoryId: string): Promise<boolean> {
    const client = this.requireClient();
    if (!client) {
      return false;
    }

    const resolved = await this.resolveInventoryId(inventoryId);
    if (!resolved) {
      return false;
    }

    const { data, error } = await client
      .from('interested_cars')
      .select('id')
      .eq('lead_id', leadId)
      .eq('inventory_id', resolved)
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.warn(`GET interested_cars: ${error.message}`);
      throw error;
    }

    return Boolean(data);
  }

  async latestInterestedCar(
    leadId: string,
  ): Promise<InterestedCarSnapshot | null> {
    const client = this.requireClient();
    if (!client || !leadId) {
      return null;
    }

    const { data, error } = await client
      .from('interested_cars')
      .select('inventory_id')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.warn(`GET interested_cars último: ${error.message}`);
      throw error;
    }

    const inventoryId = data?.inventory_id ? String(data.inventory_id) : '';
    if (!inventoryId || !isUuid(inventoryId)) {
      return null;
    }

    const { data: car, error: carError } = await client
      .from('inventoryoracle')
      .select('brand, model, year, price')
      .eq('id', inventoryId)
      .maybeSingle();

    if (carError) {
      this.logger.warn(`GET inventoryoracle interés: ${carError.message}`);
      throw carError;
    }

    if (!car) {
      return null;
    }

    return {
      inventoryId,
      brand: String(car.brand ?? ''),
      model: String(car.model ?? ''),
      year: car.year == null ? null : Number(car.year),
      price: car.price == null ? null : Number(car.price),
    };
  }

  async insertInterestedCar(row: InterestedCarInput): Promise<void> {
    const client = this.requireClient();
    if (!client) {
      return;
    }

    const inventoryId = await this.resolveInventoryId(row.inventoryId);
    if (!inventoryId) {
      this.logger.warn(
        `interested_cars omitido: inventory_id inválido (${row.inventoryId})`,
      );
      return;
    }

    const { error } = await client.from('interested_cars').upsert(
      {
        lead_id: row.leadId,
        inventory_id: inventoryId,
        vehicle_uid: row.vehicleUid,
      },
      { onConflict: 'vehicle_uid', ignoreDuplicates: true },
    );

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
    const safe = sanitizeLeadAnalysisPatch(patch);
    if (!client || Object.keys(safe).length === 0) {
      return;
    }

    const { error } = await client.from('leads').update(safe).eq('id', leadId);

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
      brand: (row.brand || 'sin marca').trim() || 'sin marca',
      model: (row.model || 'sin modelo').trim() || 'sin modelo',
      year: coerceTradeInYear(row.year),
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

  async insertChatHistory(
    rows: Array<{ session_id: string; message: Record<string, unknown> }>,
  ): Promise<void> {
    const client = this.requireClient();
    if (!client || rows.length === 0) {
      return;
    }

    const { error } = await client.from('n8n_chat_histories').insert(rows);
    if (error) {
      this.logger.warn(`INSERT n8n_chat_histories: ${error.message}`);
      throw error;
    }
  }

  async listChatHistory(
    sessionId: string,
    limit: number,
  ): Promise<Array<{ message: unknown }>> {
    const client = this.requireClient();
    if (!client || !sessionId || limit <= 0) {
      return [];
    }

    const { data, error } = await client
      .from('n8n_chat_histories')
      .select('message')
      .eq('session_id', sessionId)
      .order('id', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.warn(`GET n8n_chat_histories session=${sessionId}: ${error.message}`);
      throw error;
    }

    return (data ?? []) as Array<{ message: unknown }>;
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
      assignedTo: row.assigned_to ? String(row.assigned_to) : null,
      mensajesEnviados: Array.isArray(row.mensajes_enviados)
        ? row.mensajes_enviados.map(String)
        : [],
      behaviorSignals:
        row.behavior_signals && typeof row.behavior_signals === 'object'
          ? (row.behavior_signals as LeadRow['behaviorSignals'])
          : {},
      botApagado: row.bot_apagado === true,
      botApagadoAt: row.bot_apagado_at ? String(row.bot_apagado_at) : null,
      ultimoMensajeIgnorado: row.ultimo_mensaje_ignorado
        ? String(row.ultimo_mensaje_ignorado)
        : null,
      handoffTurns: parseHandoffTurns(row.handoff_transcript),
      handoffResumen: row.handoff_resumen ? String(row.handoff_resumen) : null,
    };
  }
}
