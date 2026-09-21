import { CrmService } from '../crm/crm.service';
import { HandoffService } from '../handoff/handoff.service';
import { InboxService } from '../inbox/inbox.service';
import { MediaService } from '../media/media.service';
import { PersistenceService } from '../persistence/persistence.service';
import { DEFAULT_ASSIGNEE } from '../handoff/seller-map';
import { kommoWabaPictureBody } from './fixtures/kommo-waba-picture.body';
import { kommoWabaTextBody } from './fixtures/kommo-waba-text.body';
import { kommoWabaVoiceBody } from './fixtures/kommo-waba-voice.body';
import { WebhookService } from './webhook.service';

describe('WebhookService', () => {
  const inbox = { claimMessage: jest.fn(), scheduleDebounce: jest.fn() };
  const crm = { getContactPhone: jest.fn(), inspectLead: jest.fn() };
  const handoff = { assigneeFromKommoLead: jest.fn() };
  const media = { toCustomerText: jest.fn() };
  const persistence = {
    recordStoppedMessage: jest.fn(),
    consumeHandoffTurns: jest.fn(),
  };
  const runLog = { record: jest.fn() };
  const service = new WebhookService(
    inbox as unknown as InboxService,
    crm as unknown as CrmService,
    handoff as unknown as HandoffService,
    media as unknown as MediaService,
    persistence as unknown as PersistenceService,
    runLog as never,
  );

  beforeEach(() => {
    inbox.claimMessage.mockReset();
    inbox.claimMessage.mockResolvedValue('claimed');
    inbox.scheduleDebounce.mockReset();
    inbox.scheduleDebounce.mockResolvedValue('scheduled');
    crm.getContactPhone.mockReset();
    crm.getContactPhone.mockResolvedValue('+593999000111');
    crm.inspectLead.mockReset();
    crm.inspectLead.mockResolvedValue({ stopped: false, raw: {} });
    persistence.recordStoppedMessage.mockReset();
    persistence.recordStoppedMessage.mockResolvedValue(null);
    persistence.consumeHandoffTurns.mockReset();
    persistence.consumeHandoffTurns.mockResolvedValue([]);
    handoff.assigneeFromKommoLead.mockReset();
    handoff.assigneeFromKommoLead.mockReturnValue(DEFAULT_ASSIGNEE);
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
    expect(crm.inspectLead).toHaveBeenCalledWith('41807269');
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
      assignedTo: DEFAULT_ASSIGNEE,
    });
  });

  it('corta el lead excluido de n8n', async () => {
    await expect(
      service.handleKommo({
        ...kommoWabaTextBody,
        'message[add][0][entity_id]': '30296877',
      }),
    ).resolves.toEqual({
      accepted: false,
      reason: 'excluded_lead',
    });
    expect(inbox.claimMessage).not.toHaveBeenCalled();
    expect(inbox.scheduleDebounce).not.toHaveBeenCalled();
  });

  it('corta si atiende IA? está marcado y guarda el texto', async () => {
    crm.inspectLead.mockResolvedValue({ stopped: true, raw: {} });

    await expect(service.handleKommo(kommoWabaTextBody)).resolves.toEqual({
      accepted: false,
      reason: 'bot_stopped',
    });
    expect(crm.getContactPhone).not.toHaveBeenCalled();
    expect(inbox.scheduleDebounce).not.toHaveBeenCalled();
    expect(persistence.recordStoppedMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: '59458509',
        leadIdKommo: '41807269',
        role: 'customer',
        text: 'Hola. Me interesa el Suzuki Grand Vitara 2015',
      }),
    );
    expect(runLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'bot_stopped',
        leadId: '41807269',
        detail: expect.objectContaining({
          atiende_ia: true,
          quien: 'cliente',
          texto: 'Hola. Me interesa el Suzuki Grand Vitara 2015',
        }),
      }),
    );
  });

  it('guarda lo que dice el asesor mientras el bot está apagado', async () => {
    crm.inspectLead.mockResolvedValue({ stopped: true, raw: {} });

    await expect(
      service.handleKommo({
        ...kommoWabaTextBody,
        'message[add][0][type]': 'outgoing',
        'message[add][0][author][type]': 'user',
        'message[add][0][author][name]': 'Vanessa',
        'message[add][0][text]': 'Le llamo en 10 minutos',
      }),
    ).resolves.toEqual({
      accepted: false,
      reason: 'handoff_note',
    });
    expect(persistence.recordStoppedMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'seller',
        text: 'Le llamo en 10 minutos',
        authorName: 'Vanessa',
      }),
    );
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

  it('Instagram no se corta aunque atiende IA? esté marcado', async () => {
    crm.inspectLead.mockResolvedValue({ stopped: true, raw: {} });

    await expect(
      service.handleKommo({
        ...kommoWabaTextBody,
        'message[add][0][origin]': 'instagram',
      }),
    ).resolves.toMatchObject({
      accepted: true,
      route: 'other',
      debounce: 'scheduled',
    });
    expect(crm.inspectLead).not.toHaveBeenCalled();
  });

  it('Instagram no entra al agente ni mira atiende IA?', async () => {
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
    expect(crm.inspectLead).not.toHaveBeenCalled();
    expect(crm.getContactPhone).not.toHaveBeenCalled();
    expect(persistence.consumeHandoffTurns).not.toHaveBeenCalled();
    expect(inbox.scheduleDebounce).toHaveBeenCalledWith({
      contactId: '59458509',
      messageId: 'ae7243c7-e973-4aa5-ad43-ae3a95d74233',
      text: 'Hola. Me interesa el Suzuki Grand Vitara 2015',
      leadId: '41807269',
      name: 'Rosa Gonzalez',
      phone: null,
      source: 'instagram',
      createdAt: '1789340833',
    });
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

  it('al prender el bot consume el tramo y no lo mete crudo a memoria', async () => {
    persistence.consumeHandoffTurns.mockResolvedValue([
      { role: 'customer', name: null, text: 'Hola', at: 't1' },
      { role: 'seller', name: 'Vanessa', text: 'ya le llamo', at: 't2' },
    ]);

    await expect(service.handleKommo(kommoWabaTextBody)).resolves.toMatchObject({
      accepted: true,
      debounce: 'scheduled',
    });
    expect(persistence.consumeHandoffTurns).toHaveBeenCalledWith('59458509');
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
