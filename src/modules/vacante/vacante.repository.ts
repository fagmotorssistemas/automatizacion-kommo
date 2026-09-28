import { Inject, Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import {
  SUPABASE_CONFIG,
  type SupabaseConfig,
} from '../persistence/supabase.config';

export type OfertaLaboralInsert = {
  leadIdKommo: string;
  phone: string | null;
  etiqueta: string;
  assignedTo: string;
};

export type OfertaLookup = 'found' | 'missing' | 'unavailable';
export type OfertaInsertResult = 'created' | 'exists' | 'unavailable';

@Injectable()
export class VacanteRepository {
  private readonly logger = new Logger(VacanteRepository.name);
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

  async findByLeadId(leadIdKommo: string): Promise<OfertaLookup> {
    if (!this.client || !leadIdKommo) {
      return 'unavailable';
    }

    const { data, error } = await this.client
      .from('ofertas_laborales')
      .select('lead_id_kommo')
      .eq('lead_id_kommo', leadIdKommo)
      .maybeSingle();

    if (error) {
      this.logger.error(`find ofertas_laborales: ${error.message}`);
      return 'unavailable';
    }

    return data ? 'found' : 'missing';
  }

  async insert(row: OfertaLaboralInsert): Promise<OfertaInsertResult> {
    if (!this.client || !row.leadIdKommo) {
      return 'unavailable';
    }

    const { error } = await this.client.from('ofertas_laborales').insert({
      lead_id_kommo: row.leadIdKommo,
      phone: row.phone,
      etiqueta: row.etiqueta,
      assigned_to: row.assignedTo,
    });

    if (!error) {
      return 'created';
    }

    if (error.code === '23505') {
      return 'exists';
    }

    this.logger.error(`insert ofertas_laborales: ${error.message}`);
    return 'unavailable';
  }
}
