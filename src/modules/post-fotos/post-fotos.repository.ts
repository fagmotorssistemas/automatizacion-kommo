import { Inject, Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import { SUPABASE_CONFIG, type SupabaseConfig } from '../persistence/supabase.config';
import type { PostFotosPaso } from './post-fotos.constants';

export type DuePostFotosRow = {
  id: number;
  leadId: number | null;
  sessionId: string;
  paso: PostFotosPaso;
  programada: Date;
  leadIdKommo: string | null;
  contactId: number;
  name: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  mileage: number | null;
  fuelType: string | null;
  color: string | null;
  botApagado: boolean;
  respondioPostFotos: boolean;
};

@Injectable()
export class PostFotosRepository {
  private readonly logger = new Logger(PostFotosRepository.name);
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
      .from('lead_post_fotos')
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

  async schedulePaso(input: {
    leadId: number | null;
    sessionId: string;
    paso: PostFotosPaso;
    programada: Date;
  }): Promise<void> {
    if (!this.client) {
      throw new Error('Supabase sin URL o service role');
    }
    const { error } = await this.client.from('lead_post_fotos').insert({
      lead_id: input.leadId,
      session_id: input.sessionId,
      paso: input.paso,
      programada: input.programada.toISOString(),
    });
    if (error) {
      // Unique pending: ya hay ese paso pendiente.
      if (error.code === '23505') {
        return;
      }
      this.logger.error(`schedulePaso: ${error.message}`);
      throw error;
    }
  }

  async cancelPending(sessionId: string, reason: string): Promise<number> {
    if (!this.client) {
      throw new Error('Supabase sin URL o service role');
    }
    const { data, error } = await this.client
      .from('lead_post_fotos')
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

  async listDue(limit: number): Promise<DuePostFotosRow[]> {
    if (!this.client) {
      throw new Error('Supabase sin URL o service role');
    }
    const { data, error } = await this.client.rpc('fn_list_due_post_fotos', {
      p_limit: limit,
    });
    if (error) {
      this.logger.error(`fn_list_due_post_fotos: ${error.message}`);
      throw error;
    }

    return (data ?? []).map((raw: Record<string, unknown>) => ({
      id: Number(raw.id),
      leadId: raw.lead_id == null ? null : Number(raw.lead_id),
      sessionId: String(raw.session_id ?? ''),
      paso: Number(raw.paso) as PostFotosPaso,
      programada: new Date(String(raw.programada)),
      leadIdKommo:
        raw.lead_id_kommo == null ? null : String(raw.lead_id_kommo),
      contactId: Number(raw.contact_id) || 0,
      name: String(raw.name ?? '').trim() || 'Cliente',
      brand: raw.brand == null ? null : String(raw.brand),
      model: raw.model == null ? null : String(raw.model),
      year: raw.year == null ? null : Number(raw.year),
      price: raw.price == null ? null : Number(raw.price),
      mileage: raw.mileage == null ? null : Number(raw.mileage),
      fuelType: raw.fuel_type == null ? null : String(raw.fuel_type),
      color: raw.color == null ? null : String(raw.color),
      botApagado: raw.bot_apagado === true,
      respondioPostFotos: raw.respondio_post_fotos === true,
    }));
  }

  async markSent(id: number, mensaje: string): Promise<void> {
    if (!this.client) {
      throw new Error('Supabase sin URL o service role');
    }
    const { error } = await this.client
      .from('lead_post_fotos')
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
      .from('lead_post_fotos')
      .update({ cancelada: reason })
      .eq('id', id);
    if (error) {
      this.logger.error(`markCancelled: ${error.message}`);
      throw error;
    }
  }

  /** Compat: el flag viejo del RPC n8n, por si algo aún lo mira. */
  async markMensajePostFotosFlag(leadIdKommo: number): Promise<void> {
    if (!this.client) {
      return;
    }
    const { error } = await this.client
      .from('leads')
      .update({ mensaje_post_fotos_enviado: true })
      .eq('lead_id_kommo', leadIdKommo);
    if (error) {
      this.logger.warn(`markMensajePostFotosFlag: ${error.message}`);
    }
  }
}
