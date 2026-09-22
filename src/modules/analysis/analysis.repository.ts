import { Inject, Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import { SUPABASE_CONFIG, type SupabaseConfig } from '../persistence/supabase.config';
import type { SeguimientoEstado } from '../followup/followup.constants';
import { ObjecionTipo } from './objecion';
import { FormaPago } from './parse-analysis';

export type ConversationPacket = {
  sessionId: string;
  leadId: number | null;
  etapaSql: number;
  vehiculos: string[];
  precioMax: number | null;
  segmentos: number;
  cubiertoHasta: string;
  cerrar: boolean;
  resumenPrevio: string | null;
  transcript: string;
};

export type SaveAnalysisInput = {
  sessionId: string;
  leadId: number | null;
  etapaMax: number;
  vehiculos: string[];
  precioMax: number | null;
  objecion: ObjecionTipo | null;
  objecionTexto: string;
  objecionEvidencia: string;
  resumen: string;
  presupuesto: string | null;
  presupuestoMonto: number | null;
  entradaDisponible: number | null;
  formaPago: FormaPago | null;
  analizadoHasta: string;
  cerrada: boolean;
  seguimiento: SeguimientoEstado;
};

@Injectable()
export class AnalysisRepository {
  private readonly logger = new Logger(AnalysisRepository.name);
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

  isReady(): boolean {
    return this.client !== null;
  }

  async claimLock(owner: string): Promise<boolean> {
    const data = await this.rpc<boolean>('fn_claim_analysis_lock', {
      p_owner: owner,
    });
    return data === true;
  }

  async releaseLock(owner: string): Promise<void> {
    await this.rpc('fn_release_analysis_lock', { p_owner: owner });
  }

  async listBatch(limit: number): Promise<string[]> {
    const data = await this.rpc<Array<{ session_id: string }>>(
      'fn_list_conversation_batch',
      { p_limit: limit },
    );
    return (data ?? []).map((row) => row.session_id).filter(Boolean);
  }

  async packet(
    sessionId: string,
    dedupMinutes: number,
  ): Promise<ConversationPacket | null> {
    const data = await this.rpc<Array<Record<string, unknown>>>(
      'fn_conversation_packet',
      { p_session_id: sessionId, p_dedup_minutes: dedupMinutes },
    );
    const row = data?.[0];
    if (!row) {
      return null;
    }

    const precio = row.precio_max;
    return {
      sessionId: String(row.session_id ?? sessionId),
      leadId: row.lead_id == null ? null : Number(row.lead_id),
      etapaSql: Number(row.etapa_sql ?? 0),
      vehiculos: Array.isArray(row.vehiculos)
        ? row.vehiculos.map((item) => String(item))
        : [],
      precioMax: precio == null || precio === '' ? null : Number(precio),
      segmentos: Number(row.segmentos ?? 0),
      cubiertoHasta: String(row.cubierto_hasta ?? ''),
      cerrar: row.cerrar === true,
      resumenPrevio:
        row.resumen_previo == null ? null : String(row.resumen_previo),
      transcript: String(row.transcript ?? ''),
    };
  }

  async clearAnalizadoHasta(sessionId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Supabase sin URL o service role');
    }
    const { error } = await this.client
      .from('lead_conversation_analysis')
      .update({ analizado_hasta: null })
      .eq('session_id', sessionId);
    if (error) {
      this.logger.error(`clearAnalizadoHasta: ${error.message}`);
      throw error;
    }
  }

  async save(input: SaveAnalysisInput): Promise<void> {
    await this.rpc('fn_save_conversation_analysis', {
      p_session_id: input.sessionId,
      p_lead_id: input.leadId,
      p_etapa_max: input.etapaMax,
      p_vehiculos: input.vehiculos,
      p_precio: input.precioMax,
      p_objecion: input.objecion,
      p_objecion_texto: input.objecionTexto,
      p_objecion_evidencia: input.objecionEvidencia,
      p_resumen: input.resumen,
      p_presupuesto: input.presupuesto,
      p_presupuesto_monto: input.presupuestoMonto,
      p_entrada_disponible: input.entradaDisponible,
      p_forma_pago: input.formaPago,
      p_analizado_hasta: input.analizadoHasta,
      p_cerrada: input.cerrada,
    });
    await this.updateSeguimiento(input.sessionId, input.seguimiento);
  }

  async updateSeguimiento(
    sessionId: string,
    seguimiento: SeguimientoEstado,
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Supabase sin URL o service role');
    }
    const { error } = await this.client
      .from('lead_conversation_analysis')
      .update({ seguimiento })
      .eq('session_id', sessionId);
    if (error) {
      this.logger.error(`updateSeguimiento: ${error.message}`);
      throw error;
    }
  }

  async purgeAnalyzedChats(): Promise<number> {
    const data = await this.rpc<number>('fn_purge_analyzed_chats');
    return Number(data ?? 0);
  }

  private async rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    if (!this.client) {
      throw new Error('Supabase sin URL o service role');
    }

    const { data, error } = await this.client.rpc(fn, args);
    if (error) {
      this.logger.error(`${fn}: ${error.message}`);
      throw error;
    }
    return data as T;
  }
}
