import { Inject, Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import { SUPABASE_CONFIG, type SupabaseConfig } from '../persistence/supabase.config';
import type { PostFotosCarInput } from './post-fotos.prompt';

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

  /** RPC leads_sin_respuesta: fotos hace ≥40 min, sin respuesta, sin mensaje enviado. */
  async listDue(limit: number): Promise<PostFotosCarInput[]> {
    if (!this.client) {
      throw new Error('Supabase sin URL o service role');
    }

    const { data, error } = await this.client.rpc('leads_sin_respuesta');
    if (error) {
      this.logger.error(`leads_sin_respuesta: ${error.message}`);
      throw error;
    }

    const seen = new Set<number>();
    const rows: PostFotosCarInput[] = [];
    for (const raw of data ?? []) {
      const row = raw as Record<string, unknown>;
      const leadIdKommo = Number(row.lead_id_kommo);
      if (!leadIdKommo || seen.has(leadIdKommo)) {
        continue;
      }
      seen.add(leadIdKommo);
      rows.push({
        leadIdKommo,
        contactId: Number(row.contact_id) || 0,
        name: String(row.name ?? '').trim() || 'Cliente',
        brand: row.brand == null ? null : String(row.brand),
        model: row.model == null ? null : String(row.model),
        year: row.year == null ? null : Number(row.year),
        price: row.price == null ? null : Number(row.price),
        mileage: row.mileage == null ? null : Number(row.mileage),
        fuelType: row.fuel_type == null ? null : String(row.fuel_type),
        color: row.color == null ? null : String(row.color),
      });
      if (rows.length >= limit) {
        break;
      }
    }
    return rows;
  }

  async markMensajeEnviado(leadIdKommo: number): Promise<void> {
    if (!this.client) {
      throw new Error('Supabase sin URL o service role');
    }
    const { error } = await this.client
      .from('leads')
      .update({ mensaje_post_fotos_enviado: true })
      .eq('lead_id_kommo', leadIdKommo);
    if (error) {
      this.logger.error(`markMensajeEnviado: ${error.message}`);
      throw error;
    }
  }
}
