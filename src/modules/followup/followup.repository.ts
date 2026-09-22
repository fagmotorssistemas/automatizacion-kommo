import { Inject, Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import { SUPABASE_CONFIG, type SupabaseConfig } from '../persistence/supabase.config';
import type { RetomaNumero, SeguimientoEstado } from './followup.constants';

export type DueFollowupRow = {
  id: number;
  leadId: number | null;
  sessionId: string;
  retoma: RetomaNumero;
  programada: Date;
  createdAt: Date;
  leadIdKommo: string | null;
  seguimiento: SeguimientoEstado;
  etapaMax: number;
  objecionPrincipal: string | null;
  resumen: string;
  vehiculos: string[];
  objecionTexto: string | null;
  objecionEvidencia: string | null;
  presupuesto: string | null;
  stop: boolean;
  botApagado: boolean;
  lastHumanAt: Date | null;
};

@Injectable()
export class FollowupRepository {
  private readonly logger = new Logger(FollowupRepository.name);
  private readonly client: SupabaseClient | null;

  constructor(@Inject(SUPABASE_CONFIG) config: SupabaseConfig) {
    this.client =
      config.url && config.serviceRoleKey
        ? createClient(config.url, config.serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
            realtime: { transport: ws as unknown as typeof WebSocket },
          })
        : null;
  }

  isReady(): boolean {
    return this.client !== null;
  }

  async hasPending(sessionId: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('Supabase sin URL o service role');
    }
    const { count, error } = await this.client
      .from('lead_followup')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .is('enviada', null)
      .is('cancelada', null);
    if (error) {
      this.logger.error(`hasPending: ${error.message}`);
      throw error;
    }
    return (count ?? 0) > 0;
  }

  async insertScheduled(
    rows: Array<{
      leadId: number | null;
      sessionId: string;
      retoma: RetomaNumero;
      programada: Date;
    }>,
  ): Promise<void> {
    if (!this.client || rows.length === 0) {
      return;
    }
    const { error } = await this.client.from('lead_followup').insert(
      rows.map((row) => ({
        lead_id: row.leadId,
        session_id: row.sessionId,
        retoma: row.retoma,
        programada: row.programada.toISOString(),
      })),
    );
    if (error) {
      this.logger.error(`insertScheduled: ${error.message}`);
      throw error;
    }
  }

  async cancelPending(sessionId: string, reason: string): Promise<number> {
    if (!this.client) {
      throw new Error('Supabase sin URL o service role');
    }
    const { data, error } = await this.client
      .from('lead_followup')
      .update({ cancelada: reason })
      .eq('session_id', sessionId)
      .is('enviada', null)
      .is('cancelada', null)
      .select('id');
    if (error) {
      this.logger.error(`cancelPending: ${error.message}`);
      throw error;
    }
    return data?.length ?? 0;
  }

  async cancelPendingAfterRetoma(
    sessionId: string,
    afterRetoma: RetomaNumero,
    reason: string,
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Supabase sin URL o service role');
    }
    const { error } = await this.client
      .from('lead_followup')
      .update({ cancelada: reason })
      .eq('session_id', sessionId)
      .gt('retoma', afterRetoma)
      .is('enviada', null)
      .is('cancelada', null);
    if (error) {
      this.logger.error(`cancelPendingAfterRetoma: ${error.message}`);
      throw error;
    }
  }

  async markRespondio(sessionId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Supabase sin URL o service role');
    }
    const { data, error } = await this.client
      .from('lead_followup')
      .select('id, retoma')
      .eq('session_id', sessionId)
      .not('enviada', 'is', null)
      .eq('respondio', false)
      .order('enviada', { ascending: false })
      .limit(1);
    if (error) {
      this.logger.error(`markRespondio select: ${error.message}`);
      throw error;
    }
    const row = data?.[0];
    if (!row) {
      return;
    }
    const { error: updErr } = await this.client
      .from('lead_followup')
      .update({ respondio: true })
      .eq('id', row.id);
    if (updErr) {
      this.logger.error(`markRespondio update: ${updErr.message}`);
      throw updErr;
    }
    await this.cancelPendingAfterRetoma(
      sessionId,
      Number(row.retoma) as RetomaNumero,
      'respondio_retoma',
    );
  }

  async markSent(id: number, mensaje: string): Promise<void> {
    if (!this.client) {
      throw new Error('Supabase sin URL o service role');
    }
    const { error } = await this.client
      .from('lead_followup')
      .update({
        enviada: new Date().toISOString(),
        mensaje,
      })
      .eq('id', id);
    if (error) {
      this.logger.error(`markSent: ${error.message}`);
      throw error;
    }
  }

  async markCancelled(id: number, reason: string): Promise<void> {
    if (!this.client) {
      throw new Error('Supabase sin URL o service role');
    }
    const { error } = await this.client
      .from('lead_followup')
      .update({ cancelada: reason })
      .eq('id', id);
    if (error) {
      this.logger.error(`markCancelled: ${error.message}`);
      throw error;
    }
  }

  async listDue(limit: number): Promise<DueFollowupRow[]> {
    const data = await this.rpc<Array<Record<string, unknown>>>(
      'fn_list_due_followups',
      { p_limit: limit },
    );
    return (data ?? []).map((row) => this.mapDue(row));
  }

  private mapDue(row: Record<string, unknown>): DueFollowupRow {
    const seguimiento = String(row.seguimiento ?? 'activo');
    return {
      id: Number(row.id),
      leadId: row.lead_id == null ? null : Number(row.lead_id),
      sessionId: String(row.session_id),
      retoma: Number(row.retoma) as RetomaNumero,
      programada: new Date(String(row.programada)),
      createdAt: new Date(String(row.created_at ?? row.programada)),
      leadIdKommo:
        row.lead_id_kommo == null ? null : String(row.lead_id_kommo),
      seguimiento:
        seguimiento === 'aplazado' || seguimiento === 'cerrado'
          ? seguimiento
          : 'activo',
      etapaMax: Number(row.etapa_max ?? 0),
      objecionPrincipal:
        row.objecion_principal == null
          ? null
          : String(row.objecion_principal),
      resumen: String(row.resumen ?? ''),
      vehiculos: Array.isArray(row.vehiculos_consultados)
        ? row.vehiculos_consultados.map(String)
        : [],
      objecionTexto:
        row.objecion_texto == null ? null : String(row.objecion_texto),
      objecionEvidencia:
        row.objecion_evidencia == null
          ? null
          : String(row.objecion_evidencia),
      presupuesto:
        row.presupuesto_declarado == null
          ? null
          : String(row.presupuesto_declarado),
      stop: row.stop === true,
      botApagado: row.bot_apagado === true,
      lastHumanAt: row.last_human_at
        ? new Date(String(row.last_human_at))
        : null,
    };
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
