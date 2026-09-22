import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  SUPABASE_GATEWAY,
  SupabaseGateway,
} from '../persistence/supabase.gateway';
import type { VehicleKind } from '../conversation/vehicle-kind';
import { StockCar } from './clasificar-filas';
import { parseImgPrefixes } from './parse-img-prefixes';

export const INVENTORY_TOP_K = 3;

function hidePrices(rows: unknown): unknown {
  if (!Array.isArray(rows)) {
    return rows;
  }

  return rows.map((row) => {
    if (!row || typeof row !== 'object') {
      return row;
    }
    const copy = { ...(row as Record<string, unknown>) };
    delete copy.price;
    delete copy.precio;
    if (copy.metadata && typeof copy.metadata === 'object') {
      const metadata = { ...(copy.metadata as Record<string, unknown>) };
      delete metadata.price;
      delete metadata.precio;
      copy.metadata = metadata;
    }
    return copy;
  });
}

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

  async searchInventory(
    embedding: number[],
    tipo?: VehicleKind | null,
    marca?: string | null,
    includePrice = false,
  ): Promise<string> {
    if (!this.supabase || embedding.length === 0) {
      return '[]';
    }

    try {
      const rows = await this.supabase.matchInventory(
        embedding,
        INVENTORY_TOP_K,
        {
          ...(tipo ? { tipo } : {}),
          ...(marca ? { marca } : {}),
        },
      );
      return JSON.stringify(
        includePrice ? (rows ?? []) : hidePrices(rows ?? []),
      );
    } catch (error) {
      this.logger.error(
        'match_inventoryoracle falló',
        error instanceof Error ? error.stack : undefined,
      );
      return '[]';
    }
  }

  async listAvailableExcept(brand: string): Promise<StockCar[]> {
    if (!this.supabase || !brand.trim()) {
      return [];
    }

    try {
      return await this.supabase.listAvailableExcept(brand);
    } catch (error) {
      this.logger.error(
        `No se pudo listar el resto del inventario sin ${brand}`,
        error instanceof Error ? error.stack : undefined,
      );
      return [];
    }
  }

  async listByBrand(brand: string): Promise<StockCar[]> {
    if (!this.supabase || !brand.trim()) {
      return [];
    }

    try {
      return await this.supabase.listAvailableByBrand(brand);
    } catch (error) {
      this.logger.error(
        `No se pudo listar la marca ${brand}`,
        error instanceof Error ? error.stack : undefined,
      );
      return [];
    }
  }

  /** bot_id de inventoryoracle. img_prefix solo es backup si no vino el id del carro. */
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
