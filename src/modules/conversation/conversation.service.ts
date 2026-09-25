import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.constants';
import { CtwaMatch } from '../persistence/lead.types';
import { parseVehicleKind, VehicleKind } from './vehicle-kind';
import { Gearbox } from './gearbox';
import {
  MEMORY_MAX_MESSAGES,
  MEMORY_TTL_SECONDS,
  memoryKey,
  concreteAskKey,
  gearboxKey,
  lastSeenKey,
  tomaChecklistKey,
  cashBudgetKey,
  vehicleBrandKey,
  vehicleKindKey,
} from './conversation.constants';
import {
  TomaChecklist,
  TOMA_SLOTS,
  type TomaSlot,
} from './toma-checklist';
import {
  isRealCustomerText,
  keepCustomerFacingMessages,
} from './is-real-customer-text';
import {
  InboundTextResult,
  resolveInboundText,
} from './resolve-inbound-text';

export type MemoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  resolveInboundText(input: {
    joinedText: string;
    createdAtUnix: string;
    ctwa: CtwaMatch;
    alreadyInConversation?: boolean;
  }): InboundTextResult {
    return resolveInboundText(input);
  }

  async loadVehicleKind(contactId: string): Promise<VehicleKind | null> {
    if (!contactId) {
      return null;
    }

    try {
      return parseVehicleKind(await this.redis.get(vehicleKindKey(contactId)));
    } catch (error) {
      this.logger.error(
        `No se pudo leer el tipo de vehículo contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  async saveVehicleKind(contactId: string, kind: VehicleKind): Promise<void> {
    if (!contactId) {
      return;
    }

    try {
      await this.redis.set(
        vehicleKindKey(contactId),
        kind,
        'EX',
        MEMORY_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo guardar el tipo de vehículo contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async loadGearbox(contactId: string): Promise<Gearbox | null> {
    if (!contactId) {
      return null;
    }

    try {
      const value = await this.redis.get(gearboxKey(contactId));
      return value === 'manual' || value === 'automatica' ? value : null;
    } catch (error) {
      this.logger.error(
        `No se pudo leer la caja contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  async saveGearbox(contactId: string, gearbox: Gearbox): Promise<void> {
    if (!contactId) {
      return;
    }

    try {
      await this.redis.set(
        gearboxKey(contactId),
        gearbox,
        'EX',
        MEMORY_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo guardar la caja contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async loadCashBudget(contactId: string): Promise<number | null> {
    if (!contactId) {
      return null;
    }

    try {
      const value = await this.redis.get(cashBudgetKey(contactId));
      const amount = value ? Number(value) : NaN;
      return Number.isFinite(amount) && amount >= 1000 ? amount : null;
    } catch (error) {
      this.logger.error(
        `No se pudo leer tope de contado contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  async saveCashBudget(contactId: string, budget: number): Promise<void> {
    if (!contactId || !Number.isFinite(budget) || budget < 1000) {
      return;
    }

    try {
      await this.redis.set(
        cashBudgetKey(contactId),
        String(Math.round(budget)),
        'EX',
        MEMORY_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo guardar tope de contado contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async clearGearbox(contactId: string): Promise<void> {
    if (!contactId) {
      return;
    }

    try {
      await this.redis.del(gearboxKey(contactId));
    } catch (error) {
      this.logger.error(
        `No se pudo borrar la caja contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async loadVehicleBrand(contactId: string): Promise<string | null> {
    if (!contactId) {
      return null;
    }

    try {
      const value = await this.redis.get(vehicleBrandKey(contactId));
      return value?.trim() || null;
    } catch (error) {
      this.logger.error(
        `No se pudo leer la marca contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  async saveVehicleBrand(contactId: string, brand: string): Promise<void> {
    if (!contactId || !brand) {
      return;
    }

    try {
      await this.redis.set(
        vehicleBrandKey(contactId),
        brand,
        'EX',
        MEMORY_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo guardar la marca contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async loadConcreteAsk(contactId: string): Promise<string | null> {
    if (!contactId) {
      return null;
    }

    try {
      const value = await this.redis.get(concreteAskKey(contactId));
      return value?.trim() || null;
    } catch (error) {
      this.logger.error(
        `No se pudo leer el pedido concreto contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  async saveConcreteAsk(contactId: string, ask: string): Promise<void> {
    if (!contactId || !ask.trim()) {
      return;
    }

    try {
      await this.redis.set(
        concreteAskKey(contactId),
        ask.trim().slice(0, 500),
        'EX',
        MEMORY_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo guardar el pedido concreto contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async loadLastSeen(contactId: string): Promise<number | null> {
    if (!contactId) {
      return null;
    }

    try {
      const value = await this.redis.get(lastSeenKey(contactId));
      const ms = value ? Number(value) : NaN;
      return Number.isFinite(ms) && ms > 0 ? ms : null;
    } catch (error) {
      this.logger.error(
        `No se pudo leer last-seen contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  async loadTomaChecklist(contactId: string): Promise<TomaChecklist | null> {
    if (!contactId) {
      return null;
    }

    try {
      const raw = await this.redis.get(tomaChecklistKey(contactId));
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as TomaChecklist;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      const have: TomaChecklist['have'] = {};
      for (const slot of TOMA_SLOTS) {
        const value = parsed.have?.[slot];
        if (typeof value === 'string' && value.trim()) {
          have[slot] = value.trim();
        }
      }
      const pending = (Array.isArray(parsed.pending) ? parsed.pending : []).filter(
        (slot): slot is TomaSlot =>
          TOMA_SLOTS.includes(slot as TomaSlot),
      );
      return { have, pending };
    } catch (error) {
      this.logger.error(
        `No se pudo leer checklist toma contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  async saveTomaChecklist(
    contactId: string,
    checklist: TomaChecklist,
  ): Promise<void> {
    if (!contactId) {
      return;
    }

    try {
      await this.redis.set(
        tomaChecklistKey(contactId),
        JSON.stringify(checklist),
        'EX',
        MEMORY_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo guardar checklist toma contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async saveLastSeen(contactId: string, at = Date.now()): Promise<void> {
    if (!contactId) {
      return;
    }

    try {
      await this.redis.set(
        lastSeenKey(contactId),
        String(at),
        'EX',
        MEMORY_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo guardar last-seen contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async clearConcreteAsk(contactId: string): Promise<void> {
    if (!contactId) {
      return;
    }

    try {
      await this.redis.del(concreteAskKey(contactId));
    } catch (error) {
      this.logger.error(
        `No se pudo borrar el pedido concreto contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async recentMessages(contactId: string): Promise<MemoryMessage[]> {
    if (!contactId) {
      return [];
    }

    try {
      const raw = await this.redis.lrange(memoryKey(contactId), 0, -1);
      return keepCustomerFacingMessages(
        raw
          .map((row) => {
            try {
              return JSON.parse(row) as MemoryMessage;
            } catch {
              return null;
            }
          })
          .filter((item): item is MemoryMessage => Boolean(item?.role && item.content)),
      );
    } catch (error) {
      this.logger.error(
        `No se pudo leer memoria contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return [];
    }
  }

  async appendMessage(
    contactId: string,
    message: MemoryMessage,
  ): Promise<void> {
    await this.appendMessages(contactId, [message]);
  }

  async appendMessages(
    contactId: string,
    messages: MemoryMessage[],
  ): Promise<void> {
    const usable = messages.filter(
      (message) =>
        message.content &&
        (message.role !== 'user' || isRealCustomerText(message.content)),
    );
    if (!contactId || usable.length === 0) {
      return;
    }

    try {
      const key = memoryKey(contactId);
      await this.redis
        .multi()
        .rpush(key, ...usable.map((message) => JSON.stringify(message)))
        .ltrim(key, -MEMORY_MAX_MESSAGES, -1)
        .expire(key, MEMORY_TTL_SECONDS)
        .exec();
    } catch (error) {
      this.logger.error(
        `No se pudo guardar memoria contactId=${contactId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
