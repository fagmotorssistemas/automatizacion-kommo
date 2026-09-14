import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { CrmService } from './../src/modules/crm/crm.service';
import { InboxService } from './../src/modules/inbox/inbox.service';
import { MediaService } from './../src/modules/media/media.service';
import { kommoWabaTextBody } from './../src/modules/webhook/fixtures/kommo-waba-text.body';
import { WebhookController } from './../src/modules/webhook/webhook.controller';
import { WebhookService } from './../src/modules/webhook/webhook.service';

describe('Webhook (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        WebhookService,
        {
          provide: InboxService,
          useValue: {
            claimMessage: jest.fn().mockResolvedValue('claimed'),
            scheduleDebounce: jest.fn().mockResolvedValue('scheduled'),
          },
        },
        {
          provide: CrmService,
          useValue: {
            getContactPhone: jest.fn().mockResolvedValue(null),
            isLeadBotStopped: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: MediaService,
          useValue: {
            toCustomerText: jest
              .fn()
              .mockResolvedValue(
                'Hola. Me interesa el Suzuki Grand Vitara 2015',
              ),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('POST /webhooks/kommo acepta el body real urlencoded', () => {
    return request(app.getHttpServer())
      .post('/webhooks/kommo')
      .type('form')
      .send({ ...kommoWabaTextBody })
      .expect(200)
      .expect({
        accepted: true,
        messageId: 'ae7243c7-e973-4aa5-ad43-ae3a95d74233',
        leadId: '41807269',
        route: 'waba',
        phone: null,
        kind: 'text',
        text: 'Hola. Me interesa el Suzuki Grand Vitara 2015',
        debounce: 'scheduled',
      });
  });

  it('POST /webhooks/kommo ignora eventos que no son mensaje', () => {
    return request(app.getHttpServer())
      .post('/webhooks/kommo')
      .send({ leads: { update: [] } })
      .expect(200)
      .expect({
        accepted: false,
        reason: 'not_a_message_event',
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
