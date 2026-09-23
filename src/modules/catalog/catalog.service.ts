import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  SUPABASE_GATEWAY,
  SupabaseGateway,
} from '../persistence/supabase.gateway';
import type { VehicleKind } from '../conversation/vehicle-kind';
import { StockCar } from './clasificar-filas';
import { detectNamedModelAsk } from '../conversation/vehicle-brand';
import {
  buildLexicon,
  emptyLexicon,
  type VehicleLexicon,
} from '../conversation/fuzzy-vehicle-name';
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
  private lexicon: VehicleLexicon = emptyLexicon();
  private lexiconAt = 0;
  private promptNames: string[] = [];
  private promptNamesAt = 0;

  constructor(
    @Inject(SUPABASE_GATEWAY) private readonly supabase: SupabaseGateway | null,
  ) {}

  /** Marcas y modelos del patio ahora. Se refresca solo. */
  async getLexicon(): Promise<VehicleLexicon> {
    if (this.lexicon.brands.length > 0 && Date.now() - this.lexiconAt < 300_000) {
      return this.lexicon;
    }
    if (!this.supabase) {
      return emptyLexicon();
    }
    try {
      this.lexicon = buildLexicon(await this.supabase.listInventoryNames());
      this.lexiconAt = Date.now();
      return this.lexicon;
    } catch (error) {
      this.logger.warn(
        `No se pudieron leer nombres de inventario: ${error instanceof Error ? error.message : error}`,
      );
      return this.lexicon.brands.length > 0 ? this.lexicon : emptyLexicon();
    }
  }

  /** Nombres reales de agent_prompts. El clasificador no inventa filas. */
  async listAgentPromptNames(): Promise<string[]> {
    if (this.promptNames.length > 0 && Date.now() - this.promptNamesAt < 300_000) {
      return this.promptNames;
    }
    if (!this.supabase) {
      return this.promptNames;
    }
    try {
      this.promptNames = await this.supabase.listAgentPromptNames();
      this.promptNamesAt = Date.now();
      return this.promptNames;
    } catch (error) {
      this.logger.warn(
        `No se pudieron leer nombres de agent_prompts: ${error instanceof Error ? error.message : error}`,
      );
      return this.promptNames;
    }
  }

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
    const lexicon = await this.getLexicon();
    const plan = inventorySearchPlan(
      input.query,
      input.tipo ?? null,
      input.marca ?? null,
      lexicon,
    );
    const topK = plan.named ? INVENTORY_NAMED_TOP_K : INVENTORY_TOP_K;
    const family = detectNamedModelAsk(input.query, lexicon)?.family ?? '';

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
