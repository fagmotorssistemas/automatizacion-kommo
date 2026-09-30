import { Logger } from '@nestjs/common';
import { AgentService } from './agent.service';
import { TEST_LEXICON } from '../conversation/test-lexicon';
import {
  resetPatioFamiliesCache,
  VERIF_OTRO_SYSTEM_PROMPT,
  VERIF_OTRO_TIMEOUT_MS,
} from '../conversation/otro-vehiculo';

const sportage = {
  inventoryId: 'sp-1',
  brand: 'kia',
  model: 'sportage r gti',
  year: 2019,
  price: 22900,
  color: 'plateado',
  typeBody: 'jeep',
};

const santaFe = {
  id: 'santa-1',
  brand: 'hyundai',
  model: 'santa fe dm 7pas ac 2.4 5p 4x2',
  year: 2018,
  price: 18900,
  typeBody: 'jeep' as const,
};

const tucson = {
  id: 'tucson-1',
  brand: 'hyundai',
  model: 'tucson gl',
  year: 2020,
  price: 19900,
  typeBody: 'jeep' as const,
};

function resumenOtroNo(extra = ''): string {
  return [
    'SOLICITUD ACTUAL:',
    'Cliente sigue en la unidad mostrada.',
    'Pide otras: no',
    'Otro vehículo: no',
    extra,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildService(opts?: { patio?: typeof santaFe[]; resumen?: string }) {
  const openai = {
    isReady: jest.fn().mockReturnValue(true),
    complete: jest.fn(),
    completeJson: jest.fn().mockResolvedValue(null),
    researchSpecs: jest.fn().mockResolvedValue(null),
    embed: jest.fn(),
    runSalesAgent: jest.fn(),
  };
  const catalog = {
    fetchAgentPrompts: jest.fn().mockResolvedValue([{ name: 'rol', content: 'sé cordial' }]),
    listAgentPromptNames: jest.fn().mockResolvedValue([]),
    searchInventory: jest.fn().mockResolvedValue('[]'),
    searchByQuery: jest.fn().mockResolvedValue('[]'),
    listByBrand: jest.fn().mockResolvedValue([]),
    listAvailableExcept: jest.fn().mockResolvedValue(opts?.patio ?? [santaFe, tucson]),
    getLexicon: jest.fn().mockResolvedValue(TEST_LEXICON),
  };
  const conversation = {
    recentMessages: jest.fn().mockResolvedValue([
      {
        role: 'assistant',
        content: 'Estimado, tenemos disponible un Kia Sportage R GTI 2019 plateado.',
      },
    ]),
    appendMessage: jest.fn(),
    loadVehicleKind: jest.fn().mockResolvedValue(null),
    saveVehicleKind: jest.fn(),
    loadVehicleBrand: jest.fn().mockResolvedValue(null),
    saveVehicleBrand: jest.fn(),
    loadConcreteAsk: jest.fn().mockResolvedValue(null),
    saveConcreteAsk: jest.fn(),
    loadGearbox: jest.fn().mockResolvedValue(null),
    saveGearbox: jest.fn(),
    clearGearbox: jest.fn(),
    clearVehicleKind: jest.fn(),
    clearConcreteAsk: jest.fn(),
    loadLastSeen: jest.fn().mockResolvedValue(null),
    saveLastSeen: jest.fn(),
    loadTomaChecklist: jest.fn().mockResolvedValue(null),
    saveTomaChecklist: jest.fn(),
    loadCashBudget: jest.fn().mockResolvedValue(null),
    saveCashBudget: jest.fn(),
    loadPreviousResumen: jest.fn().mockResolvedValue(null),
    savePreviousResumen: jest.fn(),
  };
  const persistence = {
    loadHandoffBrief: jest.fn().mockResolvedValue(null),
    saveHandoffResumen: jest.fn(),
    appendChatHistory: jest.fn(),
    loadRecentChat: jest.fn().mockResolvedValue([]),
    latestInterestedCar: jest.fn().mockResolvedValue(sportage),
    loadLeadCedula: jest.fn().mockResolvedValue(null),
    saveLeadCedula: jest.fn(),
    loadVehicleSpecs: jest.fn().mockResolvedValue([]),
    saveVehicleSpecs: jest.fn(),
    saveChosenInterestedCar: jest.fn(),
  };
  const service = new AgentService(
    openai as never,
    catalog as never,
    conversation as never,
    persistence as never,
  );
  openai.complete
    .mockResolvedValueOnce(opts?.resumen ?? resumenOtroNo())
    .mockResolvedValueOnce('{"intenciones":["compra"]}');
  openai.runSalesAgent.mockResolvedValue(
    JSON.stringify({
      respuesta_cliente: 'Listo.',
      meta: { vehiculo: { inventory_id: 'sp-1' } },
    }),
  );
  return { service, openai, catalog, conversation, persistence };
}

function buildServiceMazdaCx3() {
  const built = buildService({
    patio: [],
    resumen: [
      'RESUMEN PREVIO:',
      'Vehículo: Mazda 3',
      'SOLICITUD ACTUAL:',
      'Cliente sigue en la unidad mostrada.',
      'Pide otras: no',
      'Otro vehículo: no',
    ].join('\n'),
  });
  built.persistence.latestInterestedCar.mockResolvedValue({
    inventoryId: 'cx3',
    brand: 'mazda',
    model: 'cx-3',
    year: 2018,
    price: 18900,
    typeBody: 'suv',
    color: 'blanco',
  });
  built.conversation.loadPreviousResumen.mockResolvedValue(
    'Vehículo: Mazda 3\nContexto: el bot mostró un CX-3',
  );
  return built;
}

function calledVerif(openai: { completeJson: jest.Mock }): boolean {
  return openai.completeJson.mock.calls.some(
    (call) => call[0] === VERIF_OTRO_SYSTEM_PROMPT,
  );
}

describe('verificación Otro vehículo cuando el resumen dice no', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    resetPatioFamiliesCache();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('tienes Santa Fe?: verificación → Santa Fe → suelta', async () => {
    const { service, openai } = buildService({ patio: [santaFe] });
    openai.completeJson.mockResolvedValue(JSON.stringify({ otro: 'Santa Fe' }));

    await service.handleTurn({ contactId: '1', customerText: 'tienes Santa Fe?' });

    expect(calledVerif(openai)).toBe(true);
    const stay = service.takeStayDecision('1');
    expect(stay?.sospecha).toBeTruthy();
    expect(stay?.verificado).toBe('Santa Fe');
    expect(stay?.stay).toBe(false);
    expect(stay?.motivo).toBe('otro_vehiculo');
  });

  it('y el Tucson? con Tucson en patio: verificación → Tucson → suelta', async () => {
    const { service, openai } = buildService({ patio: [tucson] });
    openai.completeJson.mockResolvedValue(JSON.stringify({ otro: 'Tucson' }));

    await service.handleTurn({ contactId: '1', customerText: 'y el Tucson?' });

    expect(calledVerif(openai)).toBe(true);
    const stay = service.takeStayDecision('1');
    expect(stay?.verificado).toBe('Tucson');
    expect(stay?.stay).toBe(false);
  });

  it('cuánto es el km? no llama a completeJson de verificación', async () => {
    const { service, openai } = buildService();

    await service.handleTurn({ contactId: '1', customerText: 'cuánto es el km?' });

    expect(calledVerif(openai)).toBe(false);
    expect(service.takeStayDecision('1')?.sospecha ?? null).toBeNull();
  });

  it('mi carro es un Chevrolet Aveo (toma): verificación → null → sigue', async () => {
    const { service, openai } = buildService({
      resumen: [
        'SOLICITUD ACTUAL:',
        'Cliente quiere dar su Chevrolet Aveo en parte de pago.',
        'Es toma: sí',
        'Pide otras: no',
        'Otro vehículo: no',
      ].join('\n'),
    });
    openai.completeJson.mockResolvedValue(JSON.stringify({ otro: null }));

    await service.handleTurn({
      contactId: '1',
      customerText: 'mi carro es un Chevrolet Aveo',
    });

    expect(calledVerif(openai)).toBe(true);
    const stay = service.takeStayDecision('1');
    expect(stay?.sospecha).toMatch(/chevrolet/i);
    expect(stay?.verificado).toBeNull();
    expect(stay?.stay).toBe(true);
  });

  it('verificación con timeout → sigue y el log dice timeout', async () => {
    jest.useFakeTimers();
    const { service, openai } = buildService({ patio: [santaFe] });
    openai.completeJson.mockImplementation(() => new Promise(() => undefined));

    const pending = service.handleTurn({
      contactId: '1',
      customerText: 'tienes Santa Fe?',
    });
    await jest.advanceTimersByTimeAsync(VERIF_OTRO_TIMEOUT_MS);
    const result = await pending;
    jest.useRealTimers();

    expect(result?.reply.mensaje).toBe('Listo.');
    const stay = service.takeStayDecision('1');
    expect(stay?.verificado).toBe('timeout');
    expect(stay?.stay).toBe(true);
    expect(
      logSpy.mock.calls.some(
        (call) => typeof call[0] === 'string' && /verificado=timeout/.test(call[0]),
      ),
    ).toBe(true);
  });

  it('resumen ya trae Otro vehículo: Tucson → no llama verificación', async () => {
    const { service, openai } = buildService({
      resumen: [
        'SOLICITUD ACTUAL:',
        'Cliente pregunta por Tucson.',
        'Pide otras: no',
        'Otro vehículo: Tucson',
      ].join('\n'),
    });

    await service.handleTurn({ contactId: '1', customerText: 'y el Tucson?' });

    expect(calledVerif(openai)).toBe(false);
    expect(service.takeStayDecision('1')?.verificado ?? null).toBeNull();
  });

  it('pedido Mazda 3 en el mensaje con CX-3: sospecha y verificación', async () => {
    const { service, openai } = buildServiceMazdaCx3();
    openai.completeJson.mockResolvedValue(JSON.stringify({ otro: 'Mazda 3' }));

    await service.handleTurn({
      contactId: '1',
      customerText: 'No amigo un Mazda 3 busco',
    });

    expect(calledVerif(openai)).toBe(true);
    const stay = service.takeStayDecision('1');
    expect(stay?.sospecha).toBe('Mazda 3');
    expect(stay?.verificado).toBe('Mazda 3');
  });

  it('pedido Mazda 3 y cuánto cuesta esa: sin sospecha, sigue', async () => {
    const { service, openai } = buildServiceMazdaCx3();

    await service.handleTurn({
      contactId: '1',
      customerText: 'cuánto cuesta esa?',
    });

    expect(calledVerif(openai)).toBe(false);
    const stay = service.takeStayDecision('1');
    expect(stay?.sospecha ?? null).toBeNull();
    expect(stay?.stay).toBe(true);
  });

  it('la Sportage con mostrada Sportage: sin sospecha', async () => {
    const { service, openai } = buildService();

    await service.handleTurn({ contactId: '1', customerText: 'la Sportage' });

    expect(calledVerif(openai)).toBe(false);
    expect(service.takeStayDecision('1')?.sospecha ?? null).toBeNull();
  });
});
