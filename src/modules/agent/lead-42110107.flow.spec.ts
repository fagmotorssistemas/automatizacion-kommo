import { AgentService } from './agent.service';
import { TEST_LEXICON } from '../conversation/test-lexicon';
import { PRICE_UNLOADED } from '../conversation/strip-unsolicited-price';
import { TOMA_AVALUO_CORTO } from '../conversation/toma-checklist';
import type { StockCar } from '../catalog/clasificar-filas';

const CRETA_ID = 'b7d3649a-c700-4070-b4e2-21289a45b330';
const JETOUR_ID = '11b5a9f7-da7d-4c9d-9fb4-3b8af3b4b12e';
const CONTACT = '59822961';

const creta: StockCar = {
  id: CRETA_ID,
  brand: 'hyundai',
  model: 'creta ac 1.5 5p 4x2 tm',
  year: 2022,
  price: 22990,
  typeBody: 'jeep',
  color: 'blanco',
  mileage: 45000,
};

const jetour: StockCar = {
  id: JETOUR_ID,
  brand: 'jetour',
  model: 'x70 ii ac 1.5 5p 4x2 tm',
  year: 2023,
  price: 17990,
  typeBody: 'jeep',
  color: 'negro',
  mileage: 32000,
};

const patio: StockCar[] = [creta, jetour];

const interestedCreta = {
  inventoryId: CRETA_ID,
  brand: 'hyundai',
  model: 'creta ac 1.5 5p 4x2 tm',
  year: 2022,
  price: 22990,
  typeBody: 'jeep',
  color: 'blanco',
};

const RESUMEN_20_12 = [
  'SOLICITUD ACTUAL:',
  'Cliente quiere información sobre el Hyundai Creta 2022 y menciona que tiene un jeptour x70 2022.',
  'Pide precio: no',
  'Pide ficha: sí',
  'Otro vehículo: jeptour x70 2022',
  'Quiere comprar: Hyundai Creta 2022',
  'Su carro: jeptour x70 2022',
  'Color pedido: no',
  'Toma: no',
  'Toma ficha: no',
  'Pide asesor: no',
].join('\n');

const RESUMEN_12_05 = [
  'SOLICITUD ACTUAL:',
  'Cliente quiere el precio del Hyundai Creta 2022 y fotos de su Jetour X70 2022.',
  'Pide precio: sí',
  'Otro vehículo: no',
  'Quiere comprar: Hyundai Creta 2022',
  'Su carro: Jetour X70 2022',
  'Color pedido: blanco',
  'Tipo de patio: suv',
  'Toma: sí',
  'Toma ficha: Jetour X70 2022',
  'Toma ya: marca=Jetour; modelo=X70; color=no especificado; año=2022; km=no especificado',
  'Pide asesor: no',
].join('\n');

const RESUMEN_ASESOR = [
  'SOLICITUD ACTUAL:',
  'Cliente pide hablar con un asesor.',
  'Pide precio: no',
  'Quiere comprar: Hyundai Creta 2022',
  'Su carro: Jetour X70 2022',
  'Toma: sí',
  'Pide asesor: sí',
].join('\n');

const RESUMEN_CONTROL = [
  'SOLICITUD ACTUAL:',
  'Cliente quiere un Jetour X70.',
  'Pide precio: no',
  'Quiere comprar: Jetour X70',
  'Su carro: no',
  'Toma: no',
  'Otro vehículo: no',
  'Pide asesor: no',
].join('\n');

const fichaCreta =
  'Estimado, tenemos un Hyundai Creta AC 1.5 2022 blanco. Inventory de patio.';

describe('flujo lead 42110107 (compra vs toma)', () => {
  const openai = {
    isReady: jest.fn(),
    complete: jest.fn(),
    completeJson: jest.fn(),
    researchSpecs: jest.fn(),
    embed: jest.fn(),
    runSalesAgent: jest.fn(),
  };
  const catalog = {
    fetchAgentPrompts: jest.fn(),
    listAgentPromptNames: jest.fn(),
    searchInventory: jest.fn(),
    searchByQuery: jest.fn(),
    listByBrand: jest.fn(),
    listAvailableExcept: jest.fn(),
    getLexicon: jest.fn(),
  };
  const conversation = {
    recentMessages: jest.fn(),
    appendMessage: jest.fn(),
    loadVehicleKind: jest.fn(),
    saveVehicleKind: jest.fn(),
    loadVehicleBrand: jest.fn(),
    saveVehicleBrand: jest.fn(),
    loadConcreteAsk: jest.fn(),
    saveConcreteAsk: jest.fn(),
    loadGearbox: jest.fn(),
    saveGearbox: jest.fn(),
    clearGearbox: jest.fn(),
    clearVehicleKind: jest.fn(),
    clearConcreteAsk: jest.fn(),
    loadLastSeen: jest.fn(),
    saveLastSeen: jest.fn(),
    loadTomaChecklist: jest.fn(),
    saveTomaChecklist: jest.fn(),
    loadCashBudget: jest.fn(),
    saveCashBudget: jest.fn(),
    loadPreviousResumen: jest.fn(),
    savePreviousResumen: jest.fn(),
  };
  const persistence = {
    loadHandoffBrief: jest.fn(),
    saveHandoffResumen: jest.fn(),
    appendChatHistory: jest.fn(),
    loadRecentChat: jest.fn(),
    latestInterestedCar: jest.fn(),
    loadLeadCedula: jest.fn(),
    saveLeadCedula: jest.fn(),
    loadVehicleSpecs: jest.fn(),
    saveVehicleSpecs: jest.fn(),
    saveChosenInterestedCar: jest.fn(),
  };
  const service = new AgentService(
    openai as never,
    catalog as never,
    conversation as never,
    persistence as never,
  );

  beforeEach(() => {
    openai.isReady.mockReturnValue(true);
    openai.complete.mockReset();
    openai.completeJson.mockReset();
    openai.completeJson.mockResolvedValue(null);
    openai.researchSpecs.mockReset();
    openai.researchSpecs.mockResolvedValue(null);
    openai.embed.mockReset();
    openai.embed.mockResolvedValue(null);
    openai.runSalesAgent.mockReset();
    catalog.fetchAgentPrompts.mockReset();
    catalog.listAgentPromptNames.mockReset();
    catalog.listAgentPromptNames.mockResolvedValue([]);
    catalog.searchInventory.mockReset();
    catalog.searchInventory.mockResolvedValue('[]');
    catalog.searchByQuery.mockReset();
    catalog.searchByQuery.mockResolvedValue('[]');
    catalog.listByBrand.mockReset();
    catalog.listByBrand.mockImplementation(async (brand: string) =>
      patio.filter((car) => car.brand === String(brand).toLowerCase()),
    );
    catalog.listAvailableExcept.mockReset();
    catalog.listAvailableExcept.mockResolvedValue(patio);
    catalog.getLexicon.mockReset();
    catalog.getLexicon.mockResolvedValue(TEST_LEXICON);
    conversation.recentMessages.mockReset();
    conversation.appendMessage.mockReset();
    conversation.loadVehicleKind.mockReset();
    conversation.saveVehicleKind.mockReset();
    conversation.loadVehicleBrand.mockReset();
    conversation.saveVehicleBrand.mockReset();
    conversation.loadConcreteAsk.mockReset();
    conversation.saveConcreteAsk.mockReset();
    conversation.loadGearbox.mockReset();
    conversation.loadGearbox.mockResolvedValue(null);
    conversation.saveGearbox.mockReset();
    conversation.clearGearbox.mockReset();
    conversation.clearVehicleKind.mockReset();
    conversation.clearConcreteAsk.mockReset();
    conversation.loadLastSeen.mockReset();
    conversation.loadLastSeen.mockResolvedValue(Date.now());
    conversation.saveLastSeen.mockReset();
    conversation.loadTomaChecklist.mockReset();
    conversation.loadTomaChecklist.mockResolvedValue(null);
    conversation.saveTomaChecklist.mockReset();
    conversation.loadCashBudget.mockReset();
    conversation.loadCashBudget.mockResolvedValue(null);
    conversation.saveCashBudget.mockReset();
    conversation.loadPreviousResumen.mockReset();
    conversation.loadPreviousResumen.mockResolvedValue(null);
    conversation.savePreviousResumen.mockReset();
    conversation.loadVehicleKind.mockResolvedValue(null);
    conversation.loadVehicleBrand.mockResolvedValue(null);
    conversation.loadConcreteAsk.mockResolvedValue(null);
    persistence.loadHandoffBrief.mockReset();
    persistence.loadHandoffBrief.mockResolvedValue(null);
    persistence.saveHandoffResumen.mockReset();
    persistence.appendChatHistory.mockReset();
    persistence.loadRecentChat.mockReset();
    persistence.loadRecentChat.mockResolvedValue([]);
    persistence.latestInterestedCar.mockReset();
    persistence.latestInterestedCar.mockResolvedValue(null);
    persistence.loadLeadCedula.mockReset();
    persistence.loadLeadCedula.mockResolvedValue(null);
    persistence.saveLeadCedula.mockReset();
    persistence.loadVehicleSpecs.mockReset();
    persistence.loadVehicleSpecs.mockResolvedValue([]);
    persistence.saveVehicleSpecs.mockReset();
    persistence.saveChosenInterestedCar.mockReset();
    persistence.saveChosenInterestedCar.mockResolvedValue(undefined);
    catalog.fetchAgentPrompts.mockResolvedValue([
      { name: 'rol', content: 'sé cordial' },
    ]);
  });

  async function turn(input: {
    text: string;
    resumen: string;
    reply: string;
    history: { role: string; content: string }[];
    interested?: typeof interestedCreta | null;
    sendId?: string | null;
  }) {
    conversation.recentMessages.mockResolvedValue(input.history);
    persistence.latestInterestedCar.mockResolvedValue(
      input.interested === undefined ? null : input.interested,
    );
    openai.complete
      .mockResolvedValueOnce(input.resumen)
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: input.reply,
        meta: {
          vehiculo: input.sendId ? { inventory_id: input.sendId } : null,
        },
      }),
    );
    const result = await service.handleTurn({
      contactId: CONTACT,
      customerText: input.text,
    });
    const system = String(openai.runSalesAgent.mock.calls.at(-1)?.[0].system ?? '');
    const stay = service.takeStayDecision(CONTACT);
    return { result, system, stay };
  }

  it('20:12 presenta el Creta, reconoce el Jetour como su carro y no ofrece Jetours', async () => {
    const { result, system, stay } = await turn({
      text: 'Hola. Me interesa el Hyundai Creta 2022\nTengo un jeptour x70 2022',
      resumen: RESUMEN_20_12,
      reply: 'Estimado, tenemos un Hyundai Creta AC 1.5 2022 blanco.',
      history: [],
      interested: null,
      sendId: CRETA_ID,
    });
    expect(stay?.motivo).toBe('es_toma');
    expect(system).toMatch(/creta|b7d3649a/i);
    expect(system).toMatch(/TOMA|su (carro|veh[ií]culo)|jeptour|jetour/i);
    expect(system).not.toMatch(new RegExp(`inventory_id=${JETOUR_ID}`));
    expect(system).not.toMatch(/De este modelo hay[\s\S]*x70/i);
    expect(result?.reply.mensaje).toMatch(/creta/i);
    expect(result?.reply.mensaje).not.toMatch(/tenemos un jetour/i);
    expect(persistence.saveChosenInterestedCar).toHaveBeenCalledWith(
      CONTACT,
      CRETA_ID,
    );
  });

  it('al día siguiente precio del Cretan se queda en el Creta anclado', async () => {
    const { result, system, stay } = await turn({
      text: 'precio del Cretan, por favor',
      resumen: RESUMEN_12_05,
      reply: 'El Hyundai Creta 2022 está en $22,990.',
      history: [
        {
          role: 'user',
          content: 'Hola. Me interesa el Hyundai Creta 2022\nTengo un jeptour x70 2022',
        },
        { role: 'assistant', content: fichaCreta },
      ],
      interested: interestedCreta,
      sendId: CRETA_ID,
    });
    expect(stay?.stay).toBe(true);
    expect(system).toMatch(/HILO SIGUE/i);
    expect(system).toContain(`inventory_id=${CRETA_ID}`);
    expect(system).not.toMatch(new RegExp(`inventory_id=${JETOUR_ID}`));
    expect(result?.reply.mensaje).toMatch(/22[,.]?990|22990/);
  });

  it('12:05 da $22990, no niega Jetour blanco ni agrega precio no cargado', async () => {
    const { result, system, stay } = await turn({
      text: 'Ayúdeme con el precio del Cretan. Yo voy a enviarle fotos de mi Yetul. Blanco mismo es.',
      resumen: RESUMEN_12_05,
      reply: 'Claro, le confirmo el Creta.',
      history: [{ role: 'assistant', content: fichaCreta }],
      interested: interestedCreta,
      sendId: CRETA_ID,
    });
    expect(stay?.stay).toBe(true);
    expect(stay?.banderaDeToma).toEqual(expect.arrayContaining(['color']));
    expect(system).toMatch(/HILO SIGUE/i);
    expect(system).toContain(`inventory_id=${CRETA_ID}`);
    expect(system).not.toMatch(new RegExp(`inventory_id=${JETOUR_ID}`));
    expect(result?.reply.mensaje).toMatch(/22[,.]?990|22990/);
    expect(result?.reply.mensaje).not.toMatch(/no tenemos jetour blanco/i);
    expect(result?.reply.mensaje).not.toContain(PRICE_UNLOADED);
    expect(result?.respuestaIncompleta).toBeUndefined();
  });

  it('20:14 / 20:15 no vuelve a pedir fotos si el turno anterior ya lo pidió', async () => {
    conversation.loadTomaChecklist.mockResolvedValue({
      have: { marca: 'Jetour', modelo: 'X70', anio: '2022' },
      pending: ['fotos'],
    });
    const { system } = await turn({
      text: 'Ok',
      resumen: [
        'SOLICITUD ACTUAL:',
        'Cliente confirma.',
        'Pide precio: no',
        'Quiere comprar: Hyundai Creta 2022',
        'Su carro: Jetour X70 2022',
        'Toma: sí',
        'Es acuse: sí',
        'Pide asesor: no',
      ].join('\n'),
      reply: 'Quedo atento.',
      history: [
        { role: 'assistant', content: fichaCreta },
        {
          role: 'assistant',
          content:
            'Con los datos de su Jetour X70 2022 avanzamos al avalúo. ¿Podría traerlo o enviarnos fotos?',
        },
      ],
      interested: interestedCreta,
      sendId: CRETA_ID,
    });
    expect(system).not.toMatch(/UNA pregunta: si puede traerlos o mandar fotos/i);
    expect(system).not.toContain(TOMA_AVALUO_CORTO);
    expect(system).not.toMatch(/TOMA: nos está vendiendo SU vehículo/i);
  });

  it('12:21 Pide asesor: sí registra asesorPedido y no promete la tarea', async () => {
    const { result } = await turn({
      text: 'necesito hablar con un asesor, están más confundidos',
      resumen: RESUMEN_ASESOR,
      reply: 'En un momento le confirmo el dato del Creta.',
      history: [
        { role: 'assistant', content: fichaCreta },
        {
          role: 'assistant',
          content: 'El Hyundai Creta 2022 tiene un precio de $22990.',
        },
      ],
      interested: interestedCreta,
      sendId: CRETA_ID,
    });
    expect(result?.asesorPedido).toBe(true);
    expect(result?.reply.mensaje).not.toMatch(/Le paso con un asesor/i);
  });

  it('control: Me interesa un Jetour X70 sin toma sí ofrece Jetours', async () => {
    const { system, stay } = await turn({
      text: 'Me interesa un Jetour X70',
      resumen: RESUMEN_CONTROL,
      reply: 'Tenemos un Jetour X70 II 2023.',
      history: [],
      interested: null,
      sendId: JETOUR_ID,
    });
    expect(stay?.motivo).not.toBe('es_toma');
    expect(system).toMatch(/x70|11b5a9f7/i);
    expect(system).not.toMatch(/TOMA: nos está vendiendo SU vehículo/i);
    expect(persistence.saveChosenInterestedCar).toHaveBeenCalledWith(
      CONTACT,
      JETOUR_ID,
    );
  });
});
