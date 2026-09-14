import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  SUPABASE_GATEWAY,
  SupabaseGateway,
} from '../persistence/supabase.gateway';
import { parseImgPrefixes } from './parse-img-prefixes';

export const INVENTORY_TOP_K = 3;

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    @Inject(SUPABASE_GATEWAY) private readonly supabase: SupabaseGateway | null,
  ) {}

  async fetchAgentPrompts(names: string[]) {
    if (!this.supabase) {
      return [];
    }

    try {
      return await this.supabase.fetchAgentPrompts(names);
    } catch (error) {
      this.logger.error(
        'No se pudieron leer agent_prompts',
        error instanceof Error ? error.stack : undefined,
      );
      return [];
    }
  }

  async searchInventory(embedding: number[]): Promise<string> {
    if (!this.supabase || embedding.length === 0) {
      return '[]';
    }

    try {
      const rows = await this.supabase.matchInventory(embedding, INVENTORY_TOP_K);
      return JSON.stringify(rows ?? []);
    } catch (error) {
      this.logger.error(
        'match_inventoryoracle falló',
        error instanceof Error ? error.stack : undefined,
      );
      return '[]';
    }
  }

  async resolvePhotoBots(input: {
    inventoryId?: string;
    imgPrefix?: unknown;
  }): Promise<number[]> {
    if (!this.supabase) {
      return [];
    }

    try {
      return await this.supabase.findPhotoBots({
        inventoryId: input.inventoryId,
        prefixes: parseImgPrefixes(input.imgPrefix),
      });
    } catch (error) {
      this.logger.error(
        'No se pudieron resolver salesbots de fotos',
        error instanceof Error ? error.stack : undefined,
      );
      return [];
    }
  }
}
