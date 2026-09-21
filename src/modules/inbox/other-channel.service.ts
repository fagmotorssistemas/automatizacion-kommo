import { Injectable, Logger } from '@nestjs/common';
import { extractEcuadorPhone } from '../crm/extract-ecuador-phone';
import { CrmService } from '../crm/crm.service';
import { KOMMO_PIPELINE, KOMMO_SALESBOT } from '../crm/kommo.constants';
import { extractResponsibleUserId } from '../handoff/seller-map';
import { OutboundService } from '../outbound/outbound.service';
import { OTHER_CHANNEL_ASK_WHATSAPP } from './other-channel.constants';

export type OtherChannelInput = {
  leadId: string;
  contactId: string;
  name: string;
  text: string;
};

export type OtherChannelResult = {
  action: 'ask_whatsapp' | 'existing_lead' | 'created_lead' | 'no_lead';
  phone: string | null;
  targetLeadId: string | null;
  shadow: boolean;
};

@Injectable()
export class OtherChannelService {
  private readonly logger = new Logger(OtherChannelService.name);

  constructor(
    private readonly crm: CrmService,
    private readonly outbound: OutboundService,
  ) {}

  async handle(input: OtherChannelInput): Promise<OtherChannelResult> {
    const phone = extractEcuadorPhone(input.text);
    if (!phone) {
      return this.askWhatsapp(input.leadId);
    }

    const contacts = await this.crm.searchContactsByPhone(phone);
    if (contacts.length > 0) {
      return this.runAltaOnExisting(phone);
    }

    return this.createContactAndLead(input, phone);
  }

  private async askWhatsapp(leadId: string): Promise<OtherChannelResult> {
    if (this.outbound.isShadowMode()) {
      this.logger.log(
        `SHADOW: other-channel pide WhatsApp lead=${leadId} bot=${KOMMO_SALESBOT.TEXTO}`,
      );
      return {
        action: 'ask_whatsapp',
        phone: null,
        targetLeadId: leadId,
        shadow: true,
      };
    }

    const wrote = await this.crm.setRespuestaIa(
      leadId,
      OTHER_CHANNEL_ASK_WHATSAPP,
    );
    if (wrote) {
      await this.crm.runSalesbot(KOMMO_SALESBOT.TEXTO, leadId);
    }

    return {
      action: 'ask_whatsapp',
      phone: null,
      targetLeadId: leadId,
      shadow: false,
    };
  }

  private async runAltaOnExisting(phone: string): Promise<OtherChannelResult> {
    const leads = await this.crm.searchLeadsByQuery(phone);
    const targetLeadId = leads[0] ? String(leads[0].id) : null;
    if (!targetLeadId) {
      return {
        action: 'no_lead',
        phone,
        targetLeadId: null,
        shadow: this.outbound.isShadowMode(),
      };
    }

    await this.fireAlta(targetLeadId);
    return {
      action: 'existing_lead',
      phone,
      targetLeadId,
      shadow: this.outbound.isShadowMode(),
    };
  }

  private async createContactAndLead(
    input: OtherChannelInput,
    phone: string,
  ): Promise<OtherChannelResult> {
    const inspected = await this.crm.inspectLead(input.leadId);
    const responsibleUserId =
      extractResponsibleUserId(inspected.raw) ?? undefined;

    const contactId = await this.crm.createContactWithPhone({
      name: input.name,
      phone,
      responsibleUserId,
    });
    if (!contactId) {
      return {
        action: 'no_lead',
        phone,
        targetLeadId: null,
        shadow: this.outbound.isShadowMode(),
      };
    }

    const newLeadId = await this.crm.createLeadInPipeline({
      name: input.name,
      contactId,
      pipelineId: KOMMO_PIPELINE.NUEVOS,
      responsibleUserId,
    });
    if (!newLeadId) {
      return {
        action: 'no_lead',
        phone,
        targetLeadId: null,
        shadow: this.outbound.isShadowMode(),
      };
    }

    if (responsibleUserId) {
      await this.crm.updateLeadResponsible(newLeadId, responsibleUserId);
    }

    await this.fireAlta(String(newLeadId));
    return {
      action: 'created_lead',
      phone,
      targetLeadId: String(newLeadId),
      shadow: this.outbound.isShadowMode(),
    };
  }

  private async fireAlta(leadId: string): Promise<void> {
    if (this.outbound.isShadowMode()) {
      this.logger.log(
        `SHADOW: other-channel salesbot ${KOMMO_SALESBOT.ALTA_CONTACTO} lead=${leadId}`,
      );
      return;
    }

    await this.crm.runSalesbot(KOMMO_SALESBOT.ALTA_CONTACTO, leadId);
  }
}
