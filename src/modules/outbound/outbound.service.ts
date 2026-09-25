import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ParsedAgentOutput,
  type PhotoQueueItem,
} from '../agent/parse-agent-output';
import { CatalogService } from '../catalog/catalog.service';
import { CrmService } from '../crm/crm.service';
import { KOMMO_SALESBOT } from '../crm/kommo.constants';
import { isUuid } from '../persistence/is-uuid';
import { OUTBOUND_CONFIG, type OutboundConfig } from './outbound.config';
import { PHOTO_PACK_GAP_MS } from './outbound.constants';
import { appendNoPhotosNotice, stripUnsentPhotoClaim } from './no-photos-notice';
import { shouldSendVehiclePhotos } from './should-send-photos';

export type OutboundDispatchResult = {
  delivered: boolean;
  shadow: boolean;
  photoBots: number[];
  /** Había carro UUID pero sin bot_id → se avisó al cliente. */
  missingPhotos: boolean;
};

export type SendTextResult = {
  wrote: boolean;
  botRan: boolean;
};

@Injectable()
export class OutboundService {
  private readonly logger = new Logger(OutboundService.name);

  constructor(
    private readonly crm: CrmService,
    private readonly catalog: CatalogService,
    @Inject(OUTBOUND_CONFIG) private readonly outboundConfig: OutboundConfig,
  ) {}

  isShadowMode(): boolean {
    return this.outboundConfig.shadowMode;
  }

  /**
   * PATCH campo Respuesta IA (2991944) + salesbot de texto 157134.
   * No mira SHADOW: el caller decide. Opcional wait antes del bot (post-fotos).
   */
  async sendText(
    leadId: string,
    text: string,
    options?: { waitBeforeBotMs?: number },
  ): Promise<SendTextResult> {
    if (!leadId || !text.trim()) {
      return { wrote: false, botRan: false };
    }

    const wrote = await this.crm.setRespuestaIa(leadId, text);
    if (!wrote) {
      return { wrote: false, botRan: false };
    }

    const waitMs = options?.waitBeforeBotMs ?? 0;
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    const botRan = await this.crm.runSalesbot(KOMMO_SALESBOT.TEXTO, leadId);
    return { wrote: true, botRan };
  }

  async dispatch(
    leadId: string,
    reply: ParsedAgentOutput,
    options?: {
      alreadyShown?: boolean;
      wantsPhotos?: boolean;
      skipFirstShot?: boolean;
      photoQueue?: PhotoQueueItem[];
      packGapMs?: number;
    },
  ): Promise<OutboundDispatchResult> {
    const queue = options?.photoQueue?.filter((item) => item.inventoryId) ?? [];
    if (queue.length > 1) {
      return this.dispatchPhotoQueue(leadId, queue, options?.packGapMs);
    }
    if (queue.length === 1 && !reply.meta.vehiculo?.inventory_id) {
      reply.meta.vehiculo = { inventory_id: queue[0].inventoryId };
      if (!reply.mensaje.trim()) {
        reply.mensaje = queue[0].label;
      }
    }
    const inventoryId = reply.meta.vehiculo?.inventory_id?.trim() ?? '';
    const sendPhotos = shouldSendVehiclePhotos({
      inventoryId,
      alreadyShown: options?.alreadyShown === true,
      wantsPhotos: options?.wantsPhotos === true,
      skipFirstShot: options?.skipFirstShot === true,
    });
    const photoBots = sendPhotos
      ? await this.catalog.resolvePhotoBots({
          inventoryId: inventoryId || undefined,
        })
      : [];

    const missingPhotos =
      sendPhotos &&
      Boolean(inventoryId) &&
      isUuid(inventoryId) &&
      photoBots.length === 0;

    let mensaje = reply.mensaje;
    if (missingPhotos) {
      this.logger.warn(
        `Sin fotos (bot_id vacío) lead=${leadId} inventory=${inventoryId}`,
      );
      mensaje = appendNoPhotosNotice(mensaje);
    } else if (!sendPhotos) {
      mensaje = stripUnsentPhotoClaim(mensaje);
    }

    if (this.outboundConfig.shadowMode) {
      this.logger.log(
        [
          'SHADOW: no se envía a WhatsApp. Respuesta que se habría mandado:',
          `lead=${leadId}`,
          `inventory=${inventoryId || 'ninguno'}`,
          `fotos_bots=${photoBots.join(',') || 'ninguno'}`,
          `sin_fotos=${missingPhotos}`,
          '--- TEXTO ---',
          mensaje || '(sin texto)',
          '-------------',
        ].join('\n'),
      );
      return {
        delivered: false,
        shadow: true,
        photoBots,
        missingPhotos,
      };
    }

    if (mensaje) {
      await this.sendText(leadId, mensaje);
    }

    for (const botId of photoBots) {
      await this.crm.runSalesbot(botId, leadId);
    }

    this.logger.log(
      `Outbound lead=${leadId} texto=${Boolean(mensaje)} fotos=${photoBots.length} sin_fotos=${missingPhotos}`,
    );
    reply.mensaje = mensaje;
    return {
      delivered: true,
      shadow: false,
      photoBots,
      missingPhotos,
    };
  }

  private async dispatchPhotoQueue(
    leadId: string,
    queue: PhotoQueueItem[],
    packGapMs = PHOTO_PACK_GAP_MS,
  ): Promise<OutboundDispatchResult> {
    const allBots: number[] = [];
    let missingPhotos = false;
    const packs: { text: string; bots: number[] }[] = [];

    for (const item of queue) {
      const bots = await this.catalog.resolvePhotoBots({
        inventoryId: item.inventoryId,
      });
      const noBots = isUuid(item.inventoryId) && bots.length === 0;
      missingPhotos = missingPhotos || noBots;
      packs.push({
        text: noBots ? appendNoPhotosNotice(item.label) : item.label,
        bots,
      });
      allBots.push(...bots);
    }

    if (this.outboundConfig.shadowMode) {
      this.logger.log(
        [
          'SHADOW: cola de fotos, no se envía a WhatsApp.',
          `lead=${leadId}`,
          `unidades=${queue.map((item) => item.inventoryId).join(',')}`,
          `fotos_bots=${allBots.join(',') || 'ninguno'}`,
          packs.map((pack) => pack.text).join('\n---\n'),
        ].join('\n'),
      );
      return {
        delivered: false,
        shadow: true,
        photoBots: allBots,
        missingPhotos,
      };
    }

    for (let i = 0; i < queue.length; i += 1) {
      if (i > 0 && packGapMs > 0) {
        await sleep(packGapMs);
      }
      const item = queue[i];
      const pack = packs[i];
      if (pack.text) {
        await this.sendText(leadId, pack.text);
      }
      for (const botId of pack.bots) {
        await this.crm.runSalesbot(botId, leadId);
      }
      this.logger.log(
        `Outbound cola ${i + 1}/${queue.length} lead=${leadId} inventory=${item.inventoryId} fotos=${pack.bots.length}`,
      );
    }

    return {
      delivered: true,
      shadow: false,
      photoBots: allBots,
      missingPhotos,
    };
  }

  /** n8n ramal no-WABA: salesbot 187553 al crear o encontrar el lead. */
  async announceNewContact(leadId: string): Promise<{ ran: boolean; shadow: boolean }> {
    if (!leadId) {
      return { ran: false, shadow: this.outboundConfig.shadowMode };
    }

    if (this.outboundConfig.shadowMode) {
      this.logger.log(`SHADOW: salesbot alta contacto ${KOMMO_SALESBOT.ALTA_CONTACTO} lead=${leadId}`);
      return { ran: false, shadow: true };
    }

    const ran = await this.crm.runSalesbot(KOMMO_SALESBOT.ALTA_CONTACTO, leadId);
    return { ran, shadow: false };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
