import { AgentService } from './agent.service';
import { TEST_LEXICON } from '../conversation/test-lexicon';
import { carsInBudget } from '../conversation/budget';
import { parseTopeAmount, resumenTopeContado } from '../intelligence/parse-resumen';
import { preferCurrentYears, type StockCar } from '../catalog/clasificar-filas';
import { leftShownCar } from '../conversation/interested-car';
import { textAsksForCredit } from '../intelligence/parse-resumen';
import { stripUnsolicitedPriceAndPlate } from '../conversation/strip-unsolicited-price';
import { asksYearOnward } from '../conversation/concrete-ask';
import { detectNamedModelAsk } from '../conversation/vehicle-brand';

/** Patio tipo A74988: 2008 ya visto, 3008 caro, Matrix viejo, Río/Picanto en tope. */
const patio: StockCar[] = [
  {
    id: 'p2008-2022',
    brand: 'peugeot',
    model: '2008 fin',
    year: 2022,
    price: 19990,
    typeBody: 'jeep',
    color: 'plomo',
    mileage: 95848,
  },
  {
    id: 'p3008-2022',
    brand: 'peugeot',
    model: '3008',
    year: 2022,
    price: 19990,
    typeBody: 'jeep',
    color: 'plata',
    mileage: 101516,
  },
  {
    id: 'matrix-2003',
    brand: 'hyundai',
    model: 'matrix gl',
    year: 2003,
    price: 7990,
    typeBody: 'hatchback',
    color: 'plata',
    mileage: 180000,
  },
  {
    id: 'rio-2018',
    brand: 'kia',
    model: 'rio lx',
    year: 2018,
    price: 9800,
    typeBody: 'sedan',
    color: 'blanco',
    mileage: 72000,
  },
  {
    id: 'picanto-2017',
    brand: 'kia',
    model: 'picanto lx',
    year: 2017,
    price: 8900,
    typeBody: 'hatchback',
    color: 'rojo',
    mileage: 64000,
  },
];

const peugeot2008 = {
  inventoryId: 'p2008-2022',
  brand: 'peugeot',
  model: '2008 fin',
  year: 2022,
  price: 19990,
  typeBody: 'jeep',
  color: 'plomo',
};

describe('flujo A74988 (mensajes de hoy)', () => {
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
    clearConcreteAsk: jest.fn(),
    loadLastSeen: jest.fn(),
    saveLastSeen: jest.fn(),
    loadTomaChecklist: jest.fn(),
    saveTomaChecklist: jest.fn(),
    loadCashBudget: jest.fn(),
    saveCashBudget: jest.fn(),
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
    openai.runSalesAgent.mockReset();
    catalog.fetchAgentPrompts.mockReset();
    catalog.listAgentPromptNames.mockReset();
    catalog.listAgentPromptNames.mockResolvedValue([]);
    catalog.searchInventory.mockReset();
    catalog.searchByQuery.mockReset();
    catalog.searchByQuery.mockResolvedValue('[]');
    catalog.listByBrand.mockReset();
    catalog.listByBrand.mockImplementation(async (brand: string) =>
      patio.filter((car) => car.brand === brand),
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
    conversation.loadVehicleKind.mockResolvedValue(null);
    conversation.loadVehicleBrand.mockResolvedValue('peugeot');
    conversation.loadConcreteAsk.mockResolvedValue(null);
    persistence.loadHandoffBrief.mockReset();
    persistence.loadHandoffBrief.mockResolvedValue(null);
    persistence.saveHandoffResumen.mockReset();
    persistence.appendChatHistory.mockReset();
    persistence.loadRecentChat.mockReset();
    persistence.loadRecentChat.mockResolvedValue([]);
    persistence.latestInterestedCar.mockReset();
    persistence.latestInterestedCar.mockResolvedValue(peugeot2008);
    persistence.loadLeadCedula.mockReset();
    persistence.loadLeadCedula.mockResolvedValue(null);
    persistence.saveLeadCedula.mockReset();
    persistence.loadVehicleSpecs.mockReset();
    persistence.loadVehicleSpecs.mockResolvedValue([]);
    persistence.saveVehicleSpecs.mockReset();
    catalog.fetchAgentPrompts.mockResolvedValue([
      { name: 'rol', content: 'sé cordial' },
    ]);
  });

  const ficha2008 =
    'Tenemos el Peugeot 2008 FIN 2022 plomo, manual, 95848 km. Aquí las fotos.';
  const precio2008 =
    'El Peugeot 2008 2022 está en $19,990. Con una entrada de $11,000 y financiamiento a 60 meses, la cuota aproximada sería de $280.05. Este valor es referencial.';

  async function turn(input: {
    text: string;
    resumen: string;
    reply: string;
    history: { role: string; content: string }[];
    interested?: typeof peugeot2008 | null;
    sendId?: string | null;
  }) {
    conversation.recentMessages.mockResolvedValue(input.history);
    persistence.latestInterestedCar.mockResolvedValue(
      input.interested === undefined ? peugeot2008 : input.interested,
    );
    openai.complete
      .mockResolvedValueOnce(input.resumen)
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: input.reply,
        meta: {
          vehiculo: input.sendId
            ? { inventory_id: input.sendId }
            : null,
        },
      }),
    );
    const result = await service.handleTurn({
      contactId: 'A74988',
      customerText: input.text,
    });
    const system = String(openai.runSalesAgent.mock.calls.at(-1)?.[0].system ?? '');
    return { result, system };
  }

  it('1) 11000 de entrada se queda en el 2008: es crédito, no presupuesto', async () => {
    const { system } = await turn({
      text: 'Sube casi 8000 dando 11000 de entrada',
      resumen:
        'SOLICITUD ACTUAL:\nCliente da 11000 de entrada para el Peugeot 2008.\nPide precio: sí\nPide crédito: sí\nTope de contado: no',
      reply:
        'Con $11,000 de entrada a 60 meses la cuota referencial del 2008 sería de $280.05.',
      history: [
        { role: 'assistant', content: ficha2008 },
        { role: 'assistant', content: precio2008 },
      ],
      sendId: 'p2008-2022',
    });
    expect(system).toMatch(/HILO SIGUE|2008/i);
    expect(system).not.toMatch(/PRESUPUESTO DE CONTADO/i);
    expect(system).not.toMatch(/matrix/i);
    expect(
      resumenTopeContado(
        'SOLICITUD ACTUAL:\nCliente da 11000 de entrada.\nTope de contado: no',
      ),
    ).toBeNull();
    expect(textAsksForCredit('Sube casi 8000 dando 11000 de entrada')).toBe(true);
  });

  it('2) unos 12000 lista lo que cabe 2010+; no el Matrix 2003 ni el 3008', async () => {
    const { system } = await turn({
      text: 'Disculpe y algun auto de unos 12000',
      resumen:
        'SOLICITUD ACTUAL:\nCliente quiere ver autos de unos 12000.\nPide precio: no\nPide crédito: no\nTope de contado: 12000',
      reply: 'En ese presupuesto hay un Río y un Picanto.',
      history: [
        { role: 'assistant', content: ficha2008 },
        { role: 'assistant', content: precio2008 },
        { role: 'user', content: 'Sube casi 8000 dando 11000 de entrada' },
      ],
      sendId: null,
    });
    expect(system).toMatch(/PRESUPUESTO DE CONTADO: \$12000/);
    expect(system).toMatch(/rio-2018|rio lx/i);
    expect(system).not.toMatch(/matrix/i);
    expect(system).not.toMatch(/inventory_id=p3008-2022/);
    expect(system).not.toMatch(/inventory_id=p2008-2022/);
  });

  it('3) accent o corolla + 4) 2012 en edelante no revive Matrix ni 3008', async () => {
    const history = [
      { role: 'assistant', content: ficha2008 },
      { role: 'assistant', content: precio2008 },
      { role: 'user', content: 'algun auto de unos 12000' },
      { role: 'user', content: 'Algun hyundai accent o tpyota corolla' },
    ];
    const { system } = await turn({
      text: '2012 en edelante',
      resumen:
        'SOLICITUD ACTUAL:\nCliente busca Toyota Corolla o Hyundai Accent 2012 en adelante, presupuesto unos 12000.\nTope de contado: 12000',
      reply: 'No tenemos Corolla 2012 en adelante. Hay un Kia Río 2018 cerca de su presupuesto.',
      history,
      interested: peugeot2008,
      sendId: 'rio-2018',
    });
    expect(system).toMatch(/2012 en adelante/i);
    expect(system).toMatch(/rio-2018|rio lx/i);
    expect(system).not.toMatch(/matrix/i);
    expect(system).not.toMatch(/inventory_id=p3008-2022/);
  });

  it('5) Ok no reabre patio ni cambia de carro', async () => {
    const { system } = await turn({
      text: 'Ok',
      resumen:
        'SOLICITUD ACTUAL:\nCliente entendió. No pide otra ficha.\nEs acuse: sí\nPide precio: no',
      reply: 'Perfecto. ¿Le armo la cuota o prefiere de contado?',
      history: [
        {
          role: 'assistant',
          content:
            'No tenemos Corolla 2012 en adelante. Hay un Kia Río 2018 blanco, 72000 km.',
        },
      ],
      interested: {
        inventoryId: 'rio-2018',
        brand: 'kia',
        model: 'rio lx',
        year: 2018,
        price: 9800,
        typeBody: 'sedan',
        color: 'blanco',
      },
      sendId: 'rio-2018',
    });
    expect(system).toMatch(/HILO SIGUE/i);
    expect(system).toContain('inventory_id=rio-2018');
    expect(system).not.toMatch(/PRESUPUESTO DE CONTADO/i);
    expect(system).not.toMatch(/matrix|3008/i);
  });

  it('6) peugeot 208 no vuelve al 3008; redondea al presupuesto 2012+', async () => {
    const { system } = await turn({
      text: 'O si tiene un peugeot 208 tbien',
      resumen:
        'SOLICITUD ACTUAL:\nCliente pregunta si hay Peugeot 208. Presupuesto unos 12000. Año 2012 en adelante.\nTope de contado: 12000',
      reply: 'No tenemos Peugeot 208. Hay un Kia Río 2018 cerca de los $12,000.',
      history: [
        { role: 'assistant', content: ficha2008 },
        { role: 'assistant', content: precio2008 },
        {
          role: 'assistant',
          content:
            'No tenemos Peugeot 208 en patio, pero puedo ofrecerle un Peugeot 3008 2022 color plata, SUV, con 101516 km.',
        },
        { role: 'user', content: 'algun auto de unos 12000' },
        { role: 'user', content: '2012 en adelante' },
      ],
      interested: {
        inventoryId: 'p3008-2022',
        brand: 'peugeot',
        model: '3008',
        year: 2022,
        price: 19990,
        typeBody: 'jeep',
      },
      sendId: 'rio-2018',
    });
    expect(system).toMatch(/No hay 208|no tenemos 208/i);
    expect(system).toMatch(/picanto-2017|rio-2018|picanto lx|rio lx/i);
    expect(system).not.toMatch(/inventory_id=p3008-2022/);
    expect(system).not.toMatch(/inventory_id=p2008-2022/);
    expect(system).not.toMatch(/matrix/i);
  });
});

describe('choques de reglas y datos inventados (hoy)', () => {
  const peugeot2008 = {
    inventoryId: 'p2008-2022',
    brand: 'peugeot',
    model: '2008 fin',
    year: 2022,
    price: 19990,
    typeBody: 'jeep' as const,
  };

  it('presupuesto de 12000 hoy mete el Matrix 2003 (sin filtro de año)', () => {
    const hits = carsInBudget(patio, 12000, 'p2008-2022');
    expect(hits.some((car) => car.id === 'rio-2018')).toBe(true);
    expect(hits.some((car) => car.id === 'p3008-2022')).toBe(false);
    expect(hits.some((car) => car.id === 'matrix-2003')).toBe(false);
  });

  it('si se aplicara año vigente, el 2003 no entra', () => {
    expect(
      preferCurrentYears(carsInBudget(patio, 12000, 'p2008-2022')).map(
        (car) => car.id,
      ),
    ).not.toContain('matrix-2003');
  });

  it('entrada no es presupuesto; unos 12000 sí; 2012 no', () => {
    expect(
      resumenTopeContado(
        'SOLICITUD ACTUAL:\nCliente da 11000 de entrada.\nTope de contado: no',
      ),
    ).toBeNull();
    expect(
      resumenTopeContado(
        'SOLICITUD ACTUAL:\nCliente quiere autos de unos 12000.\nTope de contado: 12000',
      ),
    ).toBe(12000);
    expect(parseTopeAmount('2012')).toBeNull();
    expect(asksYearOnward('2012 en edelante')).toBe(true);
    expect(detectNamedModelAsk('O si tiene un peugeot 208', TEST_LEXICON)?.family).toBe(
      '208',
    );
  });

  it('Ok con presupuesto viejo en el resumen suelta el 2008 caro', () => {
    expect(
      leftShownCar({
        text: 'Ok',
        resumen:
          'Vehículo: Peugeot 2008\nContexto: presupuesto unos 12000\nSOLICITUD ACTUAL:\nCliente entendió.\nEs acuse: sí',
        car: peugeot2008,
        lexicon: TEST_LEXICON,
      }),
    ).toBe(false);
  });

  it('el strip ya no deja $280.05 ni el hueco “está en.”', () => {
    const clean = stripUnsolicitedPriceAndPlate(
      'El Peugeot 2008 2022 está en $19,990. Con una entrada de $11,000 la cuota aproximada sería de $280.05.',
    );
    expect(clean).not.toMatch(/19,990|19990|280\.05/);
    expect(clean).not.toMatch(/está en\./i);
    expect(clean).toMatch(/Peugeot 2008 2022/i);
  });

  it('el LLM puede copiar 12000 del cliente como si fuera precio de patio', () => {
    const leaked = stripUnsolicitedPriceAndPlate(
      'Tenemos un Río 2018 en $12,000.',
      { keepPrice: false },
    );
    expect(leaked).not.toMatch(/12,000|12000|\$/);
  });
});
