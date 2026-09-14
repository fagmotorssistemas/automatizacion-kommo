import { Injectable, Logger } from '@nestjs/common';
import { ParsedAgentOutput } from '../agent/parse-agent-output';
import { CatalogService } from '../catalog/catalog.service';
import { CrmService } from '../crm/crm.service';
import { KOMMO_SALESBOT } from '../crm/kommo.constants';

@Injectable()
export class OutboundService {
  private readonly logger = new Logger(OutboundService.name);

  constructor(
    private readonly crm: CrmService,
    private readonly catalog: CatalogService,
  ) {}

  async dispatch(leadId: string, reply: ParsedAgentOutput): Promise<void> {
    if (reply.mensaje) {
      const wrote = await this.crm.setRespuestaIa(leadId, reply.mensaje);
      if (wrote) {
        await this.crm.runSalesbot(KOMMO_SALESBOT.TEXTO, leadId);
      }
    }

    const photoBots = await this.catalog.resolvePhotoBots({
      inventoryId: reply.meta.vehiculo?.inventory_id,
      imgPrefix: reply.img_prefix,
    });

    for (const botId of photoBots) {
      await this.crm.runSalesbot(botId, leadId);
    }

    this.logger.log(
      `Outbound lead=${leadId} texto=${Boolean(reply.mensaje)} fotos=${photoBots.length}`,
    );
  }
}
