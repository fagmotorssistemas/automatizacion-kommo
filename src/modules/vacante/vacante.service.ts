import { Injectable, Logger } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { CrmService } from '../crm/crm.service';
import { OutboundService } from '../outbound/outbound.service';
import { fagMotorsUserId } from './fag-motors-user';
import {
  FAG_MOTORS_ASSIGNEE,
  VACANTE_ETIQUETA,
  VACANTE_PROMPT_NAME,
} from './vacante.constants';
import { isVacanteAsesorComercial } from './is-vacante-asesor';
import { VacanteRepository } from './vacante.repository';

export type VacanteIntercept = 'pass' | 'silent' | 'opened' | 'held';

@Injectable()
export class VacanteService {
  private readonly logger = new Logger(VacanteService.name);
  private fagMotorsKommoId: number | null = null;

  constructor(
    private readonly repository: VacanteRepository,
    private readonly crm: CrmService,
    private readonly catalog: CatalogService,
    private readonly outbound: OutboundService,
  ) {}

  async intercept(input: {
    leadId: string;
    contactId: string;
    text: string;
    inbound: boolean;
  }): Promise<VacanteIntercept> {
    const found = await this.repository.findByLeadId(input.leadId);
    if (found === 'found') {
      return 'silent';
    }

    const opening =
      input.inbound && isVacanteAsesorComercial(input.text);
    if (found === 'unavailable') {
      return opening ? 'held' : 'pass';
    }

    if (!opening) {
      return 'pass';
    }

    const phone = input.contactId
      ? await this.crm.getContactPhone(input.contactId)
      : null;
    const inserted = await this.repository.insert({
      leadIdKommo: input.leadId,
      phone,
      etiqueta: VACANTE_ETIQUETA,
      assignedTo: FAG_MOTORS_ASSIGNEE,
    });

    if (inserted === 'exists') {
      return 'silent';
    }

    if (inserted !== 'created') {
      this.logger.error(
        `ofertas_laborales no insertó lead=${input.leadId}`,
      );
      return 'held';
    }

    await this.replyOnce(input.leadId);
    await this.markKommo(input.leadId);
    return 'opened';
  }

  private async replyOnce(leadId: string): Promise<void> {
    const rows = await this.catalog.fetchAgentPrompts([VACANTE_PROMPT_NAME]);
    const text =
      rows.find((row) => row.name === VACANTE_PROMPT_NAME)?.content.trim() ??
      '';
    if (!text) {
      this.logger.error(
        `agent_prompts ${VACANTE_PROMPT_NAME} vacío lead=${leadId}`,
      );
      return;
    }

    if (this.outbound.isShadowMode()) {
      this.logger.log(
        `SHADOW vacante: no se envía a WhatsApp lead=${leadId}\n${text}`,
      );
      return;
    }

    const sent = await this.outbound.sendText(leadId, text);
    if (!sent.wrote) {
      this.logger.error(`No se escribió la respuesta de vacante lead=${leadId}`);
    }
  }

  private async markKommo(leadId: string): Promise<void> {
    const responsibleUserId = await this.resolveFagMotorsUser();
    const marked = await this.crm.markVacanteLead(
      leadId,
      VACANTE_ETIQUETA,
      responsibleUserId,
    );
    if (!marked) {
      this.logger.error(
        `Kommo no etiquetó ni reasignó la vacante lead=${leadId}`,
      );
    }
  }

  private async resolveFagMotorsUser(): Promise<number | null> {
    if (this.fagMotorsKommoId) {
      return this.fagMotorsKommoId;
    }

    const id = fagMotorsUserId(await this.crm.listUsers());
    if (!id) {
      this.logger.error('No hay un único usuario Kommo llamado FAG Motors');
      return null;
    }

    this.fagMotorsKommoId = id;
    return id;
  }
}
