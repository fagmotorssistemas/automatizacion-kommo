import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { CrmService } from '../crm/crm.service';
import { HandoffService } from '../handoff/handoff.service';
import { InboxService } from '../inbox/inbox.service';
import { MediaService } from '../media/media.service';
import { PersistenceService } from '../persistence/persistence.service';
import { RunLogService } from '../runs/run-log.service';
import { DEFAULT_ASSIGNEE } from '../handoff/seller-map';
import { kommoWabaTextBody } from './fixtures/kommo-waba-text.body';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

describe('WebhookController', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
            inspectLead: jest.fn().mockResolvedValue({ stopped: false, raw: {} }),
          },
        },
        {
          provide: HandoffService,
          useValue: {
            assigneeFromKommoLead: jest.fn().mockReturnValue(DEFAULT_ASSIGNEE),
          },
        },
        {
          provide: RunLogService,
          useValue: { record: jest.fn() },
        },
        {
          provide: PersistenceService,
          useValue: {
            recordStoppedMessage: jest.fn(),
            consumeHandoffTurns: jest.fn().mockResolvedValue([]),
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

    app = module.createNestApplication();
    await app.init();
  });

  it('acepta el body real como form-urlencoded', () => {
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

  afterEach(async () => {
    await app.close();
  });
});
