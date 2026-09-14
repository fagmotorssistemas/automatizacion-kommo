import { Inject, Injectable, Logger } from '@nestjs/common';
import { KOMMO_CUSTOM_FIELD } from './kommo.constants';
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

    if (!response.ok) {
      this.logger.warn(`GET ${label} falló: ${response.status}`);
      return null;
    }

    return this.unwrap(await response.json());
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
      this.logger.warn(`${method} ${label} falló: ${response.status}`);
      return false;
    }

    return true;
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
