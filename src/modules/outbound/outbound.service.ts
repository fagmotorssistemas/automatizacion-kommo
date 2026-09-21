import { Inject, Injectable, Logger } from '@nestjs/common';
import { ParsedAgentOutput } from '../agent/parse-agent-output';
import { CatalogService } from '../catalog/catalog.service';
import { CrmService } from '../crm/crm.service';
import { KOMMO_SALESBOT } from '../crm/kommo.constants';
import { OUTBOUND_CONFIG, type OutboundConfig } from './outbound.config';

export type OutboundDispatchResult = {
  delivered: boolean;
  shadow: boolean;
  photoBots: number[];
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
    const photoBots = await this.catalog.resolvePhotoBots({
      inventoryId: reply.meta.vehiculo?.inventory_id,
      imgPrefix: reply.img_prefix,
    });

    if (this.outboundConfig.shadowMode) {
      this.logger.log(
        [
          'SHADOW: no se envía a WhatsApp. Respuesta que se habría mandado:',
          `lead=${leadId}`,
          `inventory=${reply.meta.vehiculo?.inventory_id ?? 'ninguno'}`,
          `img_prefix=${JSON.stringify(reply.img_prefix)}`,
          `fotos_bots=${photoBots.join(',') || 'ninguno'}`,
          '--- TEXTO ---',
          reply.mensaje || '(sin texto)',
          '-------------',
        ].join('\n'),
      );
      return { delivered: false, shadow: true, photoBots };
    }

    if (reply.mensaje) {
      const wrote = await this.crm.setRespuestaIa(leadId, reply.mensaje);
      if (wrote) {
        await this.crm.runSalesbot(KOMMO_SALESBOT.TEXTO, leadId);
      }
    }

    for (const botId of photoBots) {
      await this.crm.runSalesbot(botId, leadId);
    }

    this.logger.log(
      `Outbound lead=${leadId} texto=${Boolean(reply.mensaje)} fotos=${photoBots.length}`,
    );
    return { delivered: true, shadow: false, photoBots };
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
