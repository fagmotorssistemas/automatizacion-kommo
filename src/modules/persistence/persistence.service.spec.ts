import { PersistenceService } from './persistence.service';

describe('PersistenceService', () => {
  const supabase = {
    findLeadByContactId: jest.fn(),
    insertLead: jest.fn(),
    matchCtwaClick: jest.fn(),
    hasInterestedCar: jest.fn(),
    insertInterestedCar: jest.fn(),
    updateLeadSignals: jest.fn(),
    insertRequestedClientData: jest.fn(),
    insertFinancingAdvice: jest.fn(),
    updateLeadRecovery: jest.fn(),
    updateLeadAnalysis: jest.fn(),
    insertTradeIn: jest.fn(),
  };
  const service = new PersistenceService(supabase);

  beforeEach(() => {
    supabase.findLeadByContactId.mockReset();
    supabase.insertLead.mockReset();
    supabase.matchCtwaClick.mockReset();
    supabase.hasInterestedCar.mockReset();
    supabase.insertInterestedCar.mockReset();
    supabase.updateLeadSignals.mockReset();
    supabase.insertRequestedClientData.mockReset();
    supabase.insertFinancingAdvice.mockReset();
    supabase.updateLeadRecovery.mockReset();
    supabase.updateLeadAnalysis.mockReset();
    supabase.insertTradeIn.mockReset();
  });

  const input = {
    contactId: '59458509',
    leadIdKommo: '41807269',
    name: 'Rosa Gonzalez',
    phone: '+593999000111',
    source: 'waba',
  };

  it('si ya existe el lead no inserta', async () => {
    supabase.findLeadByContactId.mockResolvedValue({
      id: 'lead-row-1',
      contactId: '59458509',
      leadIdKommo: '41807269',
      name: 'Rosa Gonzalez',
      phone: '+593999000111',
      source: 'waba',
      mensajesEnviados: [],
      behaviorSignals: {},
    });
    supabase.matchCtwaClick.mockResolvedValue({
      matched: false,
      ad_headline: null,
    });

    const result = await service.syncInboundLead(input);

    expect(result.lead.status).toBe('existing');
    expect(supabase.insertLead).not.toHaveBeenCalled();
  });

  it('si no existe, crea y llama el RPC', async () => {
    supabase.findLeadByContactId.mockResolvedValue(null);
    supabase.insertLead.mockResolvedValue({
      id: 'lead-row-1',
      contactId: '59458509',
      leadIdKommo: '41807269',
      name: 'Rosa Gonzalez',
      phone: '+593999000111',
      source: 'waba',
      mensajesEnviados: [],
      behaviorSignals: {},
    });
    supabase.matchCtwaClick.mockResolvedValue({
      matched: true,
      ad_headline: 'Grand Vitara',
    });

    const result = await service.syncInboundLead(input);

    expect(result.lead.status).toBe('created');
    expect(supabase.insertLead).toHaveBeenCalledWith({
      contactId: '59458509',
      leadIdKommo: '41807269',
      name: 'Rosa Gonzalez',
      phone: '+593999000111',
      source: 'waba',
    });
    expect(result.ctwa).toEqual({
      matched: true,
      adHeadline: 'Grand Vitara',
      capturedAt: null,
    });
  });

  it('sin teléfono usable no llama el RPC', async () => {
    supabase.findLeadByContactId.mockResolvedValue({
      id: 'lead-row-2',
      contactId: '1',
      leadIdKommo: '2',
      name: 'sin nombre',
      phone: 'Sin número',
      source: 'waba',
      mensajesEnviados: [],
      behaviorSignals: {},
    });

    const result = await service.syncInboundLead({
      ...input,
      phone: null,
    });

    expect(supabase.matchCtwaClick).not.toHaveBeenCalled();
    expect(result.ctwa.matched).toBe(false);
  });

  it('guarda interested_cars si ese inventario es nuevo', async () => {
    supabase.hasInterestedCar.mockResolvedValue(false);
    supabase.insertInterestedCar.mockResolvedValue(undefined);

    await service.saveInterestedCar({
      leadId: 'lead-row-1',
      inventoryId: 'inv-1',
      vehicleUid: 'abc',
    });

    expect(supabase.hasInterestedCar).toHaveBeenCalledWith('lead-row-1', 'inv-1');
    expect(supabase.insertInterestedCar).toHaveBeenCalledWith({
      leadId: 'lead-row-1',
      inventoryId: 'inv-1',
      vehicleUid: 'abc',
    });
  });

  it('no inserta el mismo carro dos veces', async () => {
    supabase.hasInterestedCar.mockResolvedValue(true);

    await service.saveInterestedCar({
      leadId: 'lead-row-1',
      inventoryId: 'inv-1',
      vehicleUid: 'abc',
    });

    expect(supabase.insertInterestedCar).not.toHaveBeenCalled();
  });

  it('aplica señales sobre el id interno del lead', async () => {
    await service.applyLeadWrites({
      contactId: '59458509',
      lead: {
        id: 'lead-row-1',
        contactId: '59458509',
        leadIdKommo: '41807269',
        name: 'Rosa',
        phone: '+593999000111',
        source: 'waba',
        mensajesEnviados: [],
        behaviorSignals: {},
      },
      writes: {
        patch: {
          respondio_post_fotos: true,
          quiere_llamada: true,
          status: 'datos_pedidos',
        },
        missingData: { message: 'pide ficha técnica' },
        financingAdvice: null,
      },
    });

    expect(supabase.insertRequestedClientData).toHaveBeenCalledWith({
      leadId: 'lead-row-1',
      message: 'pide ficha técnica',
    });
    expect(supabase.insertFinancingAdvice).not.toHaveBeenCalled();
    expect(supabase.updateLeadSignals).toHaveBeenCalledWith('lead-row-1', {
      respondio_post_fotos: true,
      quiere_llamada: true,
      status: 'datos_pedidos',
    });
    expect(supabase.findLeadByContactId).not.toHaveBeenCalled();
  });

  it('actualiza lead_recovery del paso', async () => {
    await service.saveRecoveryResponse({
      leadId: 'lead-row-1',
      step: '7d',
      response: 'no_molesten',
      responseText: 'no me escribas',
      stop: true,
    });

    expect(supabase.updateLeadRecovery).toHaveBeenCalledWith({
      leadId: 'lead-row-1',
      step: '7d',
      response: 'no_molesten',
      responseText: 'no me escribas',
      stop: true,
    });
  });

  it('sin gateway no toca Supabase', async () => {
    const dry = new PersistenceService(null);

    await expect(dry.syncInboundLead(input)).resolves.toEqual({
      lead: { status: 'skipped' },
      ctwa: { matched: false, adHeadline: null, capturedAt: null },
    });
  });
});
