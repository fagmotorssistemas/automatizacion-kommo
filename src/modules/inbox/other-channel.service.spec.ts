import { KOMMO_PIPELINE, KOMMO_SALESBOT } from '../crm/kommo.constants';
import { OTHER_CHANNEL_ASK_WHATSAPP } from './other-channel.constants';
import { OtherChannelService } from './other-channel.service';

describe('OtherChannelService', () => {
  const crm = {
    inspectLead: jest.fn(),
    runSalesbot: jest.fn(),
    searchContactsByPhone: jest.fn(),
    searchLeadsByQuery: jest.fn(),
    createContactWithPhone: jest.fn(),
    createLeadInPipeline: jest.fn(),
    updateLeadResponsible: jest.fn(),
  };
  const outbound = {
    isShadowMode: jest.fn(),
    sendText: jest.fn(),
  };
  const service = new OtherChannelService(crm as never, outbound as never);

  const input = {
    leadId: '41423821',
    contactId: '57444397',
    name: 'prueba2',
    text: 'Hola deseo que me llamen',
  };

  beforeEach(() => {
    for (const fn of Object.values(crm)) {
      fn.mockReset();
    }
    outbound.isShadowMode.mockReset();
    outbound.sendText.mockReset();
    outbound.isShadowMode.mockReturnValue(false);
    outbound.sendText.mockResolvedValue({ wrote: true, botRan: true });
    crm.runSalesbot.mockResolvedValue(true);
    crm.inspectLead.mockResolvedValue({
      stopped: false,
      raw: { responsible_user_id: 13895303 },
    });
    crm.searchContactsByPhone.mockResolvedValue([]);
    crm.searchLeadsByQuery.mockResolvedValue([]);
    crm.createContactWithPhone.mockResolvedValue(88001);
    crm.createLeadInPipeline.mockResolvedValue(99001);
    crm.updateLeadResponsible.mockResolvedValue(true);
  });

  it('sin teléfono pide WhatsApp y dispara el bot de texto', async () => {
    await expect(service.handle(input)).resolves.toEqual({
      action: 'ask_whatsapp',
      phone: null,
      targetLeadId: '41423821',
      shadow: false,
    });
    expect(outbound.sendText).toHaveBeenCalledWith(
      '41423821',
      OTHER_CHANNEL_ASK_WHATSAPP,
    );
    expect(crm.searchContactsByPhone).not.toHaveBeenCalled();
  });

  it('en sombra no escribe Kommo al pedir WhatsApp', async () => {
    outbound.isShadowMode.mockReturnValue(true);

    await expect(service.handle(input)).resolves.toEqual({
      action: 'ask_whatsapp',
      phone: null,
      targetLeadId: '41423821',
      shadow: true,
    });
    expect(outbound.sendText).not.toHaveBeenCalled();
    expect(crm.runSalesbot).not.toHaveBeenCalled();
  });

  it('si hay teléfono y contacto, dispara 187553 en el lead existente', async () => {
    crm.searchContactsByPhone.mockResolvedValue([{ id: 100 }]);
    crm.searchLeadsByQuery.mockResolvedValue([{ id: 555 }]);

    await expect(
      service.handle({ ...input, text: 'mi whatsapp es 0987654321' }),
    ).resolves.toEqual({
      action: 'existing_lead',
      phone: '+593987654321',
      targetLeadId: '555',
      shadow: false,
    });
    expect(crm.searchLeadsByQuery).toHaveBeenCalledWith('+593987654321');
    expect(crm.runSalesbot).toHaveBeenCalledWith(
      KOMMO_SALESBOT.ALTA_CONTACTO,
      '555',
    );
    expect(crm.createContactWithPhone).not.toHaveBeenCalled();
  });

  it('si hay teléfono y no hay contacto, crea CRM y dispara 187553', async () => {
    await expect(
      service.handle({ ...input, text: 'llámame al 0987654321' }),
    ).resolves.toEqual({
      action: 'created_lead',
      phone: '+593987654321',
      targetLeadId: '99001',
      shadow: false,
    });
    expect(crm.createContactWithPhone).toHaveBeenCalledWith({
      name: 'prueba2',
      phone: '+593987654321',
      responsibleUserId: 13895303,
    });
    expect(crm.createLeadInPipeline).toHaveBeenCalledWith({
      name: 'prueba2',
      contactId: 88001,
      pipelineId: KOMMO_PIPELINE.NUEVOS,
      responsibleUserId: 13895303,
    });
    expect(crm.updateLeadResponsible).toHaveBeenCalledWith(99001, 13895303);
    expect(crm.runSalesbot).toHaveBeenCalledWith(
      KOMMO_SALESBOT.ALTA_CONTACTO,
      '99001',
    );
  });

  it('si hay contacto pero no lead, no dispara salesbot', async () => {
    crm.searchContactsByPhone.mockResolvedValue([{ id: 100 }]);
    crm.searchLeadsByQuery.mockResolvedValue([]);

    await expect(
      service.handle({ ...input, text: '0987654321' }),
    ).resolves.toEqual({
      action: 'no_lead',
      phone: '+593987654321',
      targetLeadId: null,
      shadow: false,
    });
    expect(crm.runSalesbot).not.toHaveBeenCalled();
  });
});
