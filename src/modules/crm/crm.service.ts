import { Injectable } from '@nestjs/common';
import { extractPhone } from './extract-phone';
import { isBotStopped } from './is-bot-stopped';
import { KommoClient } from './kommo.client';

export type KommoLeadInspect = {
  stopped: boolean;
  raw: unknown;
};

@Injectable()
export class CrmService {
  constructor(private readonly kommo: KommoClient) {}

  async inspectLead(leadId: string): Promise<KommoLeadInspect> {
    if (!leadId) {
      return { stopped: false, raw: null };
    }

    try {
      const raw = await this.kommo.getLead(leadId);
      return { stopped: isBotStopped(raw), raw };
    } catch {
      return { stopped: false, raw: null };
    }
  }

  async isLeadBotStopped(leadId: string): Promise<boolean> {
    return (await this.inspectLead(leadId)).stopped;
  }

  async setRespuestaIa(leadId: string, text: string): Promise<boolean> {
    if (!leadId || !text) {
      return false;
    }

    try {
      return await this.kommo.setRespuestaIa(leadId, text);
    } catch {
      return false;
    }
  }

  async runSalesbot(botId: number, leadId: string): Promise<boolean> {
    if (!leadId || !botId) {
      return false;
    }

    try {
      return await this.kommo.runSalesbot(botId, leadId);
    } catch {
      return false;
    }
  }

  async getContactPhone(contactId: string): Promise<string | null> {
    if (!contactId) {
      return null;
    }

    try {
      const contact = await this.kommo.getContact(contactId);
      return extractPhone(contact);
    } catch {
      return null;
    }
  }

  async searchContactsByPhone(phone: string): Promise<Array<{ id: number }>> {
    if (!phone) {
      return [];
    }

    try {
      return await this.kommo.searchContacts(phone);
    } catch {
      return [];
    }
  }

  async searchLeadsByQuery(query: string): Promise<Array<{ id: number }>> {
    if (!query) {
      return [];
    }

    try {
      return await this.kommo.searchLeads(query);
    } catch {
      return [];
    }
  }

  async createContactWithPhone(input: {
    name: string;
    phone: string;
    responsibleUserId?: number;
  }): Promise<number | null> {
    if (!input.phone) {
      return null;
    }

    try {
      return await this.kommo.createContact(input);
    } catch {
      return null;
    }
  }

  async createLeadInPipeline(input: {
    name: string;
    contactId: number;
    pipelineId: number;
    responsibleUserId?: number;
  }): Promise<number | null> {
    if (!input.contactId || !input.pipelineId) {
      return null;
    }

    try {
      return await this.kommo.createLead(input);
    } catch {
      return null;
    }
  }

  async updateLeadResponsible(
    leadId: number,
    responsibleUserId: number,
  ): Promise<boolean> {
    if (!leadId || !responsibleUserId) {
      return false;
    }

    try {
      return await this.kommo.updateLeadResponsible(leadId, responsibleUserId);
    } catch {
      return false;
    }
  }
}
