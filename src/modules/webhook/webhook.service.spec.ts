import { CrmService } from '../crm/crm.service';
import { InboxService } from '../inbox/inbox.service';
import { MediaService } from '../media/media.service';
import { kommoWabaPictureBody } from './fixtures/kommo-waba-picture.body';
import { kommoWabaTextBody } from './fixtures/kommo-waba-text.body';
import { kommoWabaVoiceBody } from './fixtures/kommo-waba-voice.body';
import { WebhookService } from './webhook.service';

describe('WebhookService', () => {
  const inbox = { claimMessage: jest.fn(), scheduleDebounce: jest.fn() };
  const crm = { getContactPhone: jest.fn(), isLeadBotStopped: jest.fn() };
  const media = { toCustomerText: jest.fn() };
  const runLog = { record: jest.fn() };
  const service = new WebhookService(
    inbox as unknown as InboxService,
    crm as unknown as CrmService,
    media as unknown as MediaService,
    runLog as never,
  );

  beforeEach(() => {
    inbox.claimMessage.mockReset();
    inbox.claimMessage.mockResolvedValue('claimed');
    inbox.scheduleDebounce.mockReset();
    inbox.scheduleDebounce.mockResolvedValue('scheduled');
    crm.getContactPhone.mockReset();
    crm.getContactPhone.mockResolvedValue('+593999000111');
    crm.isLeadBotStopped.mockReset();
    crm.isLeadBotStopped.mockResolvedValue(false);
    media.toCustomerText.mockReset();
    media.toCustomerText.mockImplementation(
      async (input: { kind: string; text: string }) => {
        if (input.kind === 'voice') {
          return 'voz transcrita';
        }
        if (input.kind === 'picture') {
          return '{"marca":"toyota"}';
        }
        return input.text;
      },
    );
  });

  it('acepta el payload real de Kommo y pide el teléfono', async () => {
    await expect(service.handleKommo(kommoWabaTextBody)).resolves.toEqual({
      accepted: true,
      messageId: 'ae7243c7-e973-4aa5-ad43-ae3a95d74233',
      leadId: '41807269',
      route: 'waba',
      phone: '+593999000111',
      kind: 'text',
      text: 'Hola. Me interesa el Suzuki Grand Vitara 2015',
      debounce: 'scheduled',
    });
    expect(crm.isLeadBotStopped).toHaveBeenCalledWith('41807269');
    expect(crm.getContactPhone).toHaveBeenCalledWith('59458509');
    expect(inbox.claimMessage).toHaveBeenCalledWith(
      '59458509',
      'ae7243c7-e973-4aa5-ad43-ae3a95d74233',
    );
    expect(inbox.scheduleDebounce).toHaveBeenCalledWith({
      contactId: '59458509',
      messageId: 'ae7243c7-e973-4aa5-ad43-ae3a95d74233',
      text: 'Hola. Me interesa el Suzuki Grand Vitara 2015',
      leadId: '41807269',
      name: 'Rosa Gonzalez',
      phone: '+593999000111',
      source: 'waba',
      createdAt: '1789340833',
    });
  });

  it('corta si atiende IA? está marcado', async () => {
    crm.isLeadBotStopped.mockResolvedValue(true);

    await expect(service.handleKommo(kommoWabaTextBody)).resolves.toEqual({
      accepted: false,
      reason: 'bot_stopped',
    });
    expect(crm.getContactPhone).not.toHaveBeenCalled();
    expect(media.toCustomerText).not.toHaveBeenCalled();
    expect(inbox.scheduleDebounce).not.toHaveBeenCalled();
  });

  it('acepta una nota de voz aunque el texto venga vacío', async () => {
    await expect(service.handleKommo(kommoWabaVoiceBody)).resolves.toEqual({
      accepted: true,
      messageId: 'ff41b03f-510e-4349-aefb-a53a8a8dfef6',
      leadId: '41423821',
      route: 'waba',
      phone: '+593999000111',
      kind: 'voice',
      text: 'voz transcrita',
      debounce: 'scheduled',
    });
  });

  it('acepta una foto aunque el texto venga vacío', async () => {
    await expect(service.handleKommo(kommoWabaPictureBody)).resolves.toEqual({
      accepted: true,
      messageId: 'DUMP-SIN-ID',
      leadId: '41423821',
      route: 'waba',
      phone: '+593999000111',
      kind: 'picture',
      text: '{"marca":"toyota"}',
      debounce: 'scheduled',
    });
  });

  it('no pide contacto si el origin no es waba', async () => {
    await expect(
      service.handleKommo({
        ...kommoWabaTextBody,
        'message[add][0][origin]': 'instagram',
      }),
    ).resolves.toEqual({
      accepted: true,
      messageId: 'ae7243c7-e973-4aa5-ad43-ae3a95d74233',
      leadId: '41807269',
      route: 'other',
      phone: null,
      kind: 'text',
      text: 'Hola. Me interesa el Suzuki Grand Vitara 2015',
      debounce: 'scheduled',
    });
    expect(crm.isLeadBotStopped).not.toHaveBeenCalled();
    expect(crm.getContactPhone).not.toHaveBeenCalled();
  });

  it('rechaza el mismo messageId si inbox lo marca duplicado', async () => {
    inbox.claimMessage.mockResolvedValue('duplicate');

    await expect(service.handleKommo(kommoWabaTextBody)).resolves.toEqual({
      accepted: false,
      reason: 'duplicate',
    });
  });

  it('ignora un mensaje saliente del bot o vendedor', async () => {
    await expect(
      service.handleKommo({
        ...kommoWabaTextBody,
        'message[add][0][type]': 'outgoing',
        'message[add][0][author][type]': 'bot',
      }),
    ).resolves.toEqual({
      accepted: false,
      reason: 'ignored_not_inbound',
    });
    expect(inbox.claimMessage).not.toHaveBeenCalled();
  });

  it('responde ignored si Kommo manda otro evento', async () => {
    await expect(service.handleKommo({ account: { id: 1 } })).resolves.toEqual({
      accepted: false,
      reason: 'not_a_message_event',
    });
  });

  it('rechaza message add sin lead', async () => {
    await expect(
      service.handleKommo({
        'message[add][0][id]': 'msg-1',
        'message[add][0][type]': 'incoming',
        'message[add][0][author][type]': 'external',
      }),
    ).resolves.toEqual({
      accepted: false,
      reason: 'invalid_message',
    });
  });
});
