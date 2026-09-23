import { Inject, Injectable, Logger } from '@nestjs/common';
import { KOMMO_CONTACT_FIELD, KOMMO_CUSTOM_FIELD } from './kommo.constants';
import { KOMMO_CONFIG, type KommoConfig } from './kommo.config';

@Injectable()
export class KommoClient {
  private readonly logger = new Logger(KommoClient.name);

  constructor(
    @Inject(KOMMO_CONFIG) private readonly kommoConfig: KommoConfig,
  ) {}

  getLead(leadId: string): Promise<unknown | null> {
    return this.get(`/api/v4/leads/${leadId}`, `lead ${leadId}`);
  }

  getContact(contactId: string): Promise<unknown | null> {
    return this.get(`/api/v4/contacts/${contactId}`, `contacto ${contactId}`);
  }

  async setRespuestaIa(leadId: string, text: string): Promise<boolean> {
    return this.patch(
      `/api/v4/leads/${leadId}`,
      {
        custom_fields_values: [
          {
            field_id: KOMMO_CUSTOM_FIELD.RESPUESTA_IA,
            values: [{ value: text }],
          },
        ],
      },
      `respuesta IA lead ${leadId}`,
    );
  }

  async setSeguimientoRespuesta(leadId: string, text: string): Promise<boolean> {
    return this.patch(
      `/api/v4/leads/${leadId}`,
      {
        custom_fields_values: [
          {
            field_id: KOMMO_CUSTOM_FIELD.RESPUESTA_SEGUIMIENTO,
            values: [{ value: text }],
          },
        ],
      },
      `respuesta seguimiento lead ${leadId}`,
    );
  }

  /** Un solo POST. El bot_id (texto o fotos) lo decide el caller. */
  async runSalesbot(botId: number, leadId: string): Promise<boolean> {
    return this.post(
      '/api/v2/salesbot/run',
      [
        {
          bot_id: botId,
          entity_id: Number(leadId),
          entity_type: 2,
        },
      ],
      `salesbot ${botId} lead ${leadId}`,
    );
  }

  async searchContacts(query: string): Promise<Array<{ id: number }>> {
    const raw = await this.get(
      `/api/v4/contacts?query=${encodeURIComponent(query)}`,
      `contactos ${query}`,
    );
    return this.embeddedIds(raw, 'contacts');
  }

  async searchLeads(query: string): Promise<Array<{ id: number }>> {
    const raw = await this.get(
      `/api/v4/leads?query=${encodeURIComponent(query)}`,
      `leads ${query}`,
    );
    return this.embeddedIds(raw, 'leads');
  }

  async createContact(input: {
    name: string;
    phone: string;
    responsibleUserId?: number;
  }): Promise<number | null> {
    const raw = await this.sendAndRead(
      'POST',
      '/api/v4/contacts',
      [
        {
          name: input.name || 'Contacto Instagram',
          ...(input.responsibleUserId
            ? { responsible_user_id: input.responsibleUserId }
            : {}),
          custom_fields_values: [
            {
              field_code: KOMMO_CONTACT_FIELD.PHONE_CODE,
              values: [{ value: input.phone }],
            },
          ],
        },
      ],
      `crear contacto ${input.phone}`,
    );
    return this.embeddedIds(raw, 'contacts')[0]?.id ?? null;
  }

  async createLead(input: {
    name: string;
    contactId: number;
    pipelineId: number;
    responsibleUserId?: number;
  }): Promise<number | null> {
    const raw = await this.sendAndRead(
      'POST',
      '/api/v4/leads',
      [
        {
          name: input.name || 'Lead Instagram',
          pipeline_id: input.pipelineId,
          ...(input.responsibleUserId
            ? { responsible_user_id: input.responsibleUserId }
            : {}),
          _embedded: { contacts: [{ id: input.contactId }] },
        },
      ],
      `crear lead ${input.contactId}`,
    );
    return this.embeddedIds(raw, 'leads')[0]?.id ?? null;
  }

  async updateLeadResponsible(
    leadId: number,
    responsibleUserId: number,
  ): Promise<boolean> {
    return this.patch(
      '/api/v4/leads',
      [{ id: leadId, responsible_user_id: responsibleUserId }],
      `responsable lead ${leadId}`,
    );
  }

  private async get(path: string, label: string): Promise<unknown | null> {
    const { baseUrl, token } = this.kommoConfig;

    if (!baseUrl || !token) {
      this.logger.warn(`Kommo sin URL o token en .env; no se llama ${label}`);
      return null;
    }

    const url = `${baseUrl.replace(/\/$/, '')}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 204) {
      return { _embedded: {} };
    }

    if (!response.ok) {
      this.logger.warn(`GET ${label} falló: ${response.status}`);
      return null;
    }

    return this.parseBody(await response.text());
  }

  private async patch(
    path: string,
    body: unknown,
    label: string,
  ): Promise<boolean> {
    return this.send('PATCH', path, body, label);
  }

  private async post(
    path: string,
    body: unknown,
    label: string,
  ): Promise<boolean> {
    return this.send('POST', path, body, label);
  }

  private async send(
    method: 'PATCH' | 'POST',
    path: string,
    body: unknown,
    label: string,
  ): Promise<boolean> {
    const { baseUrl, token } = this.kommoConfig;
    if (!baseUrl || !token) {
      this.logger.warn(`Kommo sin URL o token en .env; no se llama ${label}`);
      return false;
    }

    const url = `${baseUrl.replace(/\/$/, '')}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = (await response.text())
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 400);
      this.logger.warn(
        `${method} ${label} falló: ${response.status}${detail ? ` ${detail}` : ''}`,
      );
      return false;
    }

    return true;
  }

  private async sendAndRead(
    method: 'PATCH' | 'POST',
    path: string,
    body: unknown,
    label: string,
  ): Promise<unknown | null> {
    const { baseUrl, token } = this.kommoConfig;
    if (!baseUrl || !token) {
      this.logger.warn(`Kommo sin URL o token en .env; no se llama ${label}`);
      return null;
    }

    const url = `${baseUrl.replace(/\/$/, '')}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      this.logger.warn(`${method} ${label} falló: ${response.status}`);
      return null;
    }

    return this.parseBody(await response.text());
  }

  private embeddedIds(
    raw: unknown,
    key: string,
  ): Array<{ id: number }> {
    if (raw === null || typeof raw !== 'object') {
      return [];
    }

    const embedded = (raw as { _embedded?: Record<string, unknown> })._embedded;
    const list = embedded?.[key];
    if (!Array.isArray(list)) {
      return [];
    }

    return list
      .map((item) => {
        const id = Number((item as { id?: unknown }).id);
        return Number.isFinite(id) && id > 0 ? { id } : null;
      })
      .filter((item): item is { id: number } => item !== null);
  }

  private parseBody(text: string): unknown {
    if (!text) {
      return { _embedded: {} };
    }

    try {
      return this.unwrap(JSON.parse(text));
    } catch {
      return { _embedded: {} };
    }
  }

  private unwrap(body: unknown): unknown {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return body;
    }

    const data = (body as { data?: unknown }).data;
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return body;
      }
    }

    return data ?? body;
  }
}
