import { Inject, Injectable, Logger } from '@nestjs/common';
import { ParsedAgentOutput } from '../agent/parse-agent-output';
import { CatalogService } from '../catalog/catalog.service';
import { CrmService } from '../crm/crm.service';
import { KOMMO_SALESBOT } from '../crm/kommo.constants';
import { isUuid } from '../persistence/is-uuid';
import { OUTBOUND_CONFIG, type OutboundConfig } from './outbound.config';
import { appendNoPhotosNotice } from './no-photos-notice';

export type OutboundDispatchResult = {
  delivered: boolean;
  shadow: boolean;
  photoBots: number[];
  /** Había carro UUID pero sin bot_id → se avisó al cliente. */
  missingPhotos: boolean;
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

  async dispatch(
    leadId: string,
    reply: ParsedAgentOutput,
  ): Promise<OutboundDispatchResult> {
    const inventoryId = reply.meta.vehiculo?.inventory_id?.trim() ?? '';
    const photoBots = await this.catalog.resolvePhotoBots({
      inventoryId: inventoryId || undefined,
    });

    const missingPhotos =
      Boolean(inventoryId) && isUuid(inventoryId) && photoBots.length === 0;

    let mensaje = reply.mensaje;
    if (missingPhotos) {
      this.logger.warn(
        `Sin fotos (bot_id vacío) lead=${leadId} inventory=${inventoryId}`,
      );
      mensaje = appendNoPhotosNotice(mensaje);
    }

    const outboundReply: ParsedAgentOutput = { ...reply, mensaje };

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
      const wrote = await this.crm.setRespuestaIa(leadId, mensaje);
      if (wrote) {
        await this.crm.runSalesbot(KOMMO_SALESBOT.TEXTO, leadId);
      }
    }

    for (const botId of photoBots) {
      await this.crm.runSalesbot(botId, leadId);
    }

    this.logger.log(
      `Outbound lead=${leadId} texto=${Boolean(mensaje)} fotos=${photoBots.length} sin_fotos=${missingPhotos}`,
    );
    // Deja el texto final en el reply por si intelligence/logs lo releen.
    reply.mensaje = mensaje;
    return {
      delivered: true,
      shadow: false,
      photoBots,
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
