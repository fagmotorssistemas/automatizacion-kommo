import { Injectable } from '@nestjs/common';
import { extractPhone } from './extract-phone';
import { isBotStopped } from './is-bot-stopped';
import { KommoClient } from './kommo.client';

@Injectable()
export class CrmService {
  constructor(private readonly kommo: KommoClient) {}

  async isLeadBotStopped(leadId: string): Promise<boolean> {
    if (!leadId) {
      return false;
    }

    try {
      const lead = await this.kommo.getLead(leadId);
      return isBotStopped(lead);
    } catch {
      return false;
    }
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
}
