import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  SUPABASE_GATEWAY,
  SupabaseGateway,
} from '../persistence/supabase.gateway';
import type { VehicleKind } from '../conversation/vehicle-kind';
import { StockCar } from './clasificar-filas';
import { detectNamedModelAsk } from '../conversation/vehicle-brand';
import {
  INVENTORY_NAMED_TOP_K,
  INVENTORY_TOP_K,
  inventorySearchPlan,
  matchRowsMentionFamily,
} from './inventory-search-plan';

export { INVENTORY_TOP_K };

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
    matchCount = INVENTORY_TOP_K,
  ): Promise<string> {
    if (!this.supabase || embedding.length === 0) {
      return '[]';
    }

    try {
      const rows = await this.supabase.matchInventory(embedding, matchCount, {
        ...(tipo ? { tipo } : {}),
        ...(marca ? { marca } : {}),
      });
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

  /**
   * Embedding primero. Si nombra un modelo, no se clava en SUV/sedán viejo.
   * Si no aparece, reintenta sin tipo y luego sin marca.
   */
  async searchByQuery(input: {
    embedding: number[];
    query: string;
    tipo?: VehicleKind | null;
    marca?: string | null;
    includePrice?: boolean;
  }): Promise<string> {
    const includePrice = input.includePrice === true;
    const plan = inventorySearchPlan(
      input.query,
      input.tipo ?? null,
      input.marca ?? null,
    );
    const topK = plan.named ? INVENTORY_NAMED_TOP_K : INVENTORY_TOP_K;
    const family = detectNamedModelAsk(input.query)?.family ?? '';

    const first = await this.searchInventory(
      input.embedding,
      plan.tipo,
      plan.marca,
      includePrice,
      topK,
    );
    if (!family || matchRowsMentionFamily(first, family)) {
      return first;
    }

    if (plan.tipo) {
      const withoutTipo = await this.searchInventory(
        input.embedding,
        null,
        plan.marca,
        includePrice,
        topK,
      );
      if (matchRowsMentionFamily(withoutTipo, family)) {
        this.logger.log(`Embedding sin tipo encontró ${family}`);
        return withoutTipo;
      }
    }

    if (plan.marca) {
      const open = await this.searchInventory(
        input.embedding,
        null,
        null,
        includePrice,
        topK,
      );
      if (matchRowsMentionFamily(open, family)) {
        this.logger.log(`Embedding sin marca encontró ${family}`);
        return open;
      }
    }

    return first;
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

  /** bot_id de inventoryoracle por UUID del carro. img_prefix no dispara fotos. */
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
      });
    } catch (error) {
      this.logger.warn(
        `No se pudieron resolver salesbots de fotos: ${error instanceof Error ? error.message : error}`,
      );
      return [];
    }
  }
}
