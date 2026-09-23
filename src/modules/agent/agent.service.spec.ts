import { AgentService } from './agent.service';

describe('AgentService', () => {
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
    searchInventory: jest.fn(),
    listByBrand: jest.fn(),
    listAvailableExcept: jest.fn(),
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
  };
  const persistence = {
    loadHandoffBrief: jest.fn(),
    saveHandoffResumen: jest.fn(),
    appendChatHistory: jest.fn(),
    loadRecentChat: jest.fn(),
    latestInterestedCar: jest.fn(),
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
    catalog.searchInventory.mockReset();
    catalog.listByBrand.mockReset();
    catalog.listByBrand.mockResolvedValue([]);
    catalog.listAvailableExcept.mockReset();
    catalog.listAvailableExcept.mockResolvedValue([]);
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
    conversation.recentMessages.mockResolvedValue([]);
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
    persistence.loadVehicleSpecs.mockReset();
    persistence.loadVehicleSpecs.mockResolvedValue([]);
    persistence.saveVehicleSpecs.mockReset();
    catalog.fetchAgentPrompts.mockResolvedValue([
      { name: 'rol', content: 'sé cordial' },
    ]);
  });

  it('sin texto no llama a OpenAI', async () => {
    await expect(
      service.handleTurn({ contactId: '1', customerText: '  ' }),
    ).resolves.toBeNull();
    expect(openai.complete).not.toHaveBeenCalled();
  });

  it('no trata un RESUMEN PREVIO como mensaje del cliente', async () => {
    await expect(
      service.handleTurn({
        contactId: '1',
        customerText: 'RESUMEN PREVIO:\nVehículo: Hilux\nContexto: pidió precio',
      }),
    ).resolves.toBeNull();
    expect(openai.complete).not.toHaveBeenCalled();
    expect(conversation.appendMessage).not.toHaveBeenCalled();
  });

  it('resumen → intenciones → agente → parser', async () => {
    openai.complete
      .mockResolvedValueOnce('RESUMEN\nCliente quiere una hilux.')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Tenemos una Hilux disponible.',
        meta: { vehiculo: { inventory_id: 'inv-1' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '59458509',
      customerText: 'me interesa una hilux',
    });

    expect(result).toEqual({
      resumen: 'RESUMEN\nCliente quiere una hilux.',
      reply: {
        mensaje: 'Tenemos una Hilux disponible.',
        meta: {
          precioMostrado: false,
          cuotaMostrada: false,
          vehiculo: null,
        },
        img_prefix: '',
      },
    });
    expect(conversation.appendMessage).toHaveBeenCalledTimes(2);
    expect(persistence.appendChatHistory).toHaveBeenCalledWith({
      contactId: '59458509',
      human: 'me interesa una hilux',
      ai: expect.stringContaining('"precio_mostrado":false'),
    });
    expect(persistence.appendChatHistory).toHaveBeenCalledWith({
      contactId: '59458509',
      human: 'me interesa una hilux',
      ai: expect.stringContaining('Tenemos una Hilux disponible.'),
    });
    expect(catalog.fetchAgentPrompts).toHaveBeenCalledWith(['rol', 'compra']);
    expect(openai.complete).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      'MENSAJE ACTUAL:\nme interesa una hilux',
    );
  });

  it('si hay varias del modelo las nombra y no manda una sola', async () => {
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'r2026',
        brand: 'ford',
        model: 'ranger xlt ac 2.0 cd 4x4 ta diesel',
        year: 2026,
        price: 65990,
        typeBody: 'doble cabina',
        color: 'plomo',
      },
      {
        id: 'r2024',
        brand: 'ford',
        model: 'ranger xl ac 2.0 cd 4x2 tm diesel',
        year: 2024,
        price: 44590,
        typeBody: 'doble cabina',
        color: 'plomo',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Tenemos dos Ranger. ¿Cuál le interesa?',
        meta: { vehiculo: { inventory_id: 'r2026' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Ford ranger',
    });

    expect(openai.completeJson).not.toHaveBeenCalled();
    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Ranger XLT 2026'),
      }),
    );
    expect(result?.reply.meta.vehiculo).toBeNull();
  });

  it('si nos vende su carro no ofrece uno parecido del inventario', async () => {
    conversation.loadVehicleBrand.mockResolvedValue('kia');
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'seltos',
        brand: 'kia',
        model: 'seltos',
        year: 2020,
        price: 18000,
        typeBody: 'jeep',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente quiere vendernos su Kia Seltos 2020.',
      )
      .mockResolvedValueOnce('{"intenciones":["venta"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Para su Seltos 2020, ¿de qué color es y me pasa fotos?',
        meta: {
          vehiculo: { inventory_id: '70f0b727-15a0-4aa9-ad1e-1e8a5d203968' },
        },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Tengo un Seltos 2020 que quiero vender',
    });

    expect(catalog.listByBrand).not.toHaveBeenCalled();
    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Prohibido buscar'),
      }),
    );
    expect(result?.reply.meta.vehiculo).toBeNull();
  });

  it('si pide manual no vuelve a ofrecer el automático y manda uno parecido', async () => {
    conversation.loadVehicleBrand.mockResolvedValue('kia');
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'picanto',
      brand: 'kia',
      model: 'picanto lx ac 1.2 4p 4x2 ta',
      year: 2023,
      price: 15990,
      typeBody: 'sedan',
    });
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'picanto',
        brand: 'kia',
        model: 'picanto lx ac 1.2 4p 4x2 ta',
        year: 2023,
        price: 15990,
        typeBody: 'sedan',
      },
      {
        id: 'sportage',
        brand: 'kia',
        model: 'sportage sl ac 2.0 5p 4x2 tm',
        year: 2019,
        price: 22200,
        typeBody: 'jeep',
      },
    ]);
    catalog.listAvailableExcept.mockResolvedValue([
      {
        id: 'fiat500',
        brand: 'fiat',
        model: '500 lounge ac 1.4 3p 4x2 tm',
        year: 2017,
        price: 13990,
        typeBody: 'hatckback',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'En manual está el Fiat 500.',
        meta: { vehiculo: null },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Y en manual no dispone\nCon la jep porfavor',
    });

    expect(openai.completeJson).not.toHaveBeenCalled();
    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('inventory_id=fiat500'),
      }),
    );
    expect(result?.reply.meta.vehiculo).toEqual({ inventory_id: 'fiat500' });
  });

  it('el RESUMEN PREVIO recibe el hilo cliente-bot', async () => {
    conversation.recentMessages.mockResolvedValue([
      { role: 'user', content: 'hay ranger?' },
      { role: 'assistant', content: 'Sí, tenemos una Ranger 2024.' },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN PREVIO:\nVehículo: Ranger')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Cuesta 28990.',
        meta: { vehiculo: null },
      }),
    );

    await service.handleTurn({
      contactId: '59458509',
      customerText: 'cuánto cuesta',
    });

    expect(openai.complete).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.stringMatching(
        /HISTORIAL:\nCliente: hay ranger\?\nAsesor: Sí, tenemos una Ranger 2024\.\n\nMENSAJE ACTUAL:\ncuánto cuesta/,
      ),
    );
    expect(persistence.loadRecentChat).not.toHaveBeenCalled();
  });

  it('mastica el hilo del asesor y se lo pasa al agente de ventas', async () => {
    persistence.loadHandoffBrief.mockResolvedValue({
      leadId: 'lead-row-1',
      resumen: null,
      turns: [
        { role: 'customer', name: null, text: 'Hola', at: 't1' },
        { role: 'seller', name: 'Vanessa', text: 'Le llamo en 10', at: 't2' },
      ],
    });
    openai.complete
      .mockResolvedValueOnce(
        'VEHÍCULO:\nNo quedó claro\n\nLO QUE DIJO O PROMETIÓ EL ASESOR:\nLe llama en 10',
      )
      .mockResolvedValueOnce('RESUMEN\nCliente quiere seguir.')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Como le comentó Vanessa, le llamamos en 10 minutos.',
        meta: { vehiculo: null },
      }),
    );

    await service.handleTurn({
      contactId: '59458509',
      customerText: 'ok',
    });

    expect(persistence.saveHandoffResumen).toHaveBeenCalledWith(
      'lead-row-1',
      expect.stringContaining('Le llama en 10'),
    );
    expect(conversation.appendMessage).toHaveBeenCalledWith('59458509', {
      role: 'assistant',
      content: expect.stringContaining('CONTEXTO ASESOR'),
    });
    expect(openai.complete).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.stringContaining('RESUMEN DEL TRAMO CON ASESOR'),
    );
    expect(openai.complete).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.stringContaining('MENSAJE ACTUAL:\nok'),
    );
  });

  it('manda el tipo camioneta en cada turno y filtra la búsqueda', async () => {
    conversation.recentMessages.mockResolvedValue([
      { role: 'user', content: 'Estoy interesado en una camioneta' },
      { role: 'assistant', content: 'Tenemos dos Ranger.' },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN\nCliente quiere una poer.')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.embed.mockResolvedValue([0.1, 0.2]);
    catalog.searchInventory.mockResolvedValue('[]');
    openai.runSalesAgent.mockImplementation(
      async (input: {
        executeTool: (name: string, argsJson: string) => Promise<string>;
      }) => {
        await input.executeTool(
          'buscarvehiuclo',
          JSON.stringify({ query: 'poer' }),
        );
        return JSON.stringify({
          respuesta_cliente: 'Tenemos la Great Wall Poer.',
          meta: { vehiculo: null },
        });
      },
    );

    await service.handleTurn({
      contactId: '59458509',
      customerText: 'De esas no, yo buscaba como las poer o una parecida',
    });

    expect(conversation.saveVehicleKind).toHaveBeenCalledWith(
      '59458509',
      'camioneta',
    );
    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Tipo: camioneta'),
        user: expect.stringContaining('Tipo: camioneta'),
      }),
    );
    expect(catalog.searchInventory).toHaveBeenCalledWith(
      [0.1, 0.2],
      'camioneta',
      null,
      false,
    );
  });

  it('sigue con camioneta cuando el cliente ya no la repite', async () => {
    conversation.loadVehicleKind.mockResolvedValue('camioneta');
    conversation.recentMessages.mockResolvedValue([
      { role: 'user', content: 'y la entrada de cuánto es?' },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN\nCliente pregunta la entrada.')
      .mockResolvedValueOnce('{"intenciones":["financiamiento"]}');
    openai.embed.mockResolvedValue([0.3]);
    catalog.searchInventory.mockResolvedValue('[]');
    openai.runSalesAgent.mockImplementation(
      async (input: {
        executeTool: (name: string, argsJson: string) => Promise<string>;
      }) => {
        await input.executeTool(
          'buscarvehiuclo',
          JSON.stringify({ query: 'financiamiento camioneta' }),
        );
        return JSON.stringify({
          respuesta_cliente: 'La entrada es del 60%.',
          meta: { vehiculo: null },
        });
      },
    );

    await service.handleTurn({
      contactId: '59458509',
      customerText: 'a cuántos meses queda',
    });

    expect(catalog.searchInventory).toHaveBeenCalledWith(
      [0.3],
      'camioneta',
      null,
      false,
    );
    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.stringContaining('Tipo: camioneta'),
      }),
    );
  });

  it('si solo dice Nissan no manda un carro y lista las líneas', async () => {
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'sentra',
        brand: 'nissan',
        model: 'sentra exclusive ac 1.8 4p 4x2 ta',
        year: 2014,
        price: 13800,
        typeBody: 'sedan',
      },
      {
        id: 'xtrail',
        brand: 'nissan',
        model: 'x-trail sense cvt ac 2.5 5p 4x2 ta',
        year: 2016,
        price: 16890,
        typeBody: 'jeep',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN\nCliente dice Nissan.')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Tenemos el Sentra.',
        meta: { vehiculo: { inventory_id: 'sentra' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Nissan',
    });

    expect(conversation.saveVehicleBrand).toHaveBeenCalledWith('1', 'nissan');
    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Sentra, X-Trail'),
      }),
    );
    expect(openai.completeJson).not.toHaveBeenCalled();
    expect(result?.reply.meta.vehiculo).toBeNull();
    expect(result?.reply.img_prefix).toBe('');
  });

  it('la ficha técnica confirmada se dice como hecho', async () => {
    conversation.loadVehicleBrand.mockResolvedValue('jetour');
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'x70',
        brand: 'jetour',
        model: 'x70 plus ii ac 1.5 4x2 tm',
        year: 2025,
        price: 22800,
        typeBody: 'jeep',
      },
    ]);
    openai.researchSpecs.mockResolvedValue(
      JSON.stringify({
        fichas: [{ id: 'x70', seguro: true, dato: '7 pasajeros, 3 filas' }],
      }),
    );
    openai.completeJson.mockResolvedValue(
      JSON.stringify({ cumplen: ['x70'] }),
    );
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'El X70 Plus 2025 tiene 3 filas.',
        meta: { vehiculo: null },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'el Jetour tiene 3 filas?',
    });

    expect(openai.researchSpecs).toHaveBeenCalled();
    expect(openai.completeJson).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('7 pasajeros, 3 filas'),
    );
    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Dilo como hecho'),
      }),
    );
    expect(result?.reply.meta.vehiculo).toEqual({ inventory_id: 'x70' });
    expect(persistence.saveVehicleSpecs).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          seguro: true,
          dato: '7 pasajeros, 3 filas',
          topic: 'filas',
        }),
      ]),
    );
  });

  it('si la ficha ya está guardada no vuelve a investigar', async () => {
    conversation.loadVehicleBrand.mockResolvedValue('jetour');
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'x70',
        brand: 'jetour',
        model: 'x70 plus ii ac 1.5 4x2 tm',
        year: 2025,
        price: 22800,
        typeBody: 'jeep',
      },
    ]);
    persistence.loadVehicleSpecs.mockResolvedValue([
      {
        modelKey: 'x70 plus ii ac 1.5 4x2 tm',
        year: 2025,
        seguro: true,
        dato: '7 pasajeros, 3 filas',
      },
    ]);
    openai.completeJson.mockResolvedValue(
      JSON.stringify({ cumplen: ['x70'] }),
    );
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'El X70 Plus 2025 tiene 3 filas.',
        meta: { vehiculo: null },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'el Jetour tiene 3 filas?',
    });

    expect(openai.researchSpecs).not.toHaveBeenCalled();
    expect(persistence.saveVehicleSpecs).not.toHaveBeenCalled();
    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('7 pasajeros, 3 filas'),
      }),
    );
  });

  it('al pedir 7 pasajeros manda el único Nissan que cumple', async () => {
    conversation.recentMessages.mockResolvedValue([
      { role: 'user', content: 'Nissan' },
    ]);
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'sentra',
        brand: 'nissan',
        model: 'sentra exclusive ac 1.8 4p 4x2 ta',
        year: 2014,
        price: 13800,
        typeBody: 'sedan',
      },
      {
        id: 'xtrail',
        brand: 'nissan',
        model: 'x-trail sense cvt ac 2.5 5p 4x2 ta',
        year: 2016,
        price: 16890,
        typeBody: 'jeep',
        vin: 'CHASIS-XTRAIL',
      },
    ]);
    openai.completeJson.mockResolvedValue(
      JSON.stringify({ cumplen: ['xtrail'], no_cumplen: ['sentra'] }),
    );
    openai.complete
      .mockResolvedValueOnce('RESUMEN\nCliente quiere 7 pasajeros.')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'No tenemos. Visite la concesionaria.',
        meta: { vehiculo: { inventory_id: 'santa-fe' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Yo quiero uno de tres filas de 7 pasajeros',
    });

    expect(openai.completeJson).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('CHASIS-XTRAIL'),
    );
    expect(conversation.saveConcreteAsk).toHaveBeenCalledWith(
      '1',
      'Yo quiero uno de tres filas de 7 pasajeros',
    );
    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('REVISIÓN DEL PEDIDO'),
      }),
    );
    expect(result?.reply.meta.vehiculo).toEqual({ inventory_id: 'xtrail' });
  });

  it('si varios cumplen no manda fotos y deja que elija', async () => {
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'xtrail',
        brand: 'nissan',
        model: 'x-trail sense cvt ac 2.5 5p 4x2 ta',
        year: 2016,
        price: 16890,
        typeBody: 'jeep',
      },
      {
        id: 'epower',
        brand: 'nissan',
        model: 'x-trail epower exclusive ac 5p',
        year: 2024,
        price: 38990,
        typeBody: 'jeep',
      },
    ]);
    openai.completeJson.mockResolvedValue(
      JSON.stringify({ cumplen: ['xtrail', 'epower'] }),
    );
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Le mando el Sentra.',
        meta: { vehiculo: { inventory_id: 'sentra' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Nissan automático',
    });

    expect(result?.reply.meta.vehiculo).toBeNull();
    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('vehiculo null'),
      }),
    );
  });

  it('si ninguno cumple manda el parecido y no busca otra marca', async () => {
    conversation.loadVehicleBrand.mockResolvedValue('nissan');
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'sentra',
        brand: 'nissan',
        model: 'sentra exclusive ac 1.8 4p 4x2 ta',
        year: 2014,
        price: 13800,
        typeBody: 'sedan',
      },
      {
        id: 'xtrail',
        brand: 'nissan',
        model: 'x-trail sense cvt ac 2.5 5p 4x2 ta',
        year: 2016,
        price: 16890,
        typeBody: 'jeep',
      },
    ]);
    openai.completeJson.mockResolvedValue(
      JSON.stringify({ cumplen: [], parecidos: ['xtrail'] }),
    );
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'No hay.',
        meta: { vehiculo: null },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'quiero 7 pasajeros',
    });

    expect(catalog.listAvailableExcept).not.toHaveBeenCalled();
    expect(result?.reply.meta.vehiculo).toEqual({ inventory_id: 'xtrail' });
    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Lo más parecido'),
      }),
    );
  });

  it('si ninguno se acerca no salta solo a otra marca', async () => {
    conversation.loadVehicleBrand.mockResolvedValue('nissan');
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'sentra',
        brand: 'nissan',
        model: 'sentra exclusive ac 1.8 4p 4x2 ta',
        year: 2014,
        price: 13800,
        typeBody: 'sedan',
      },
    ]);
    openai.completeJson.mockResolvedValue(
      JSON.stringify({ cumplen: [], parecidos: [] }),
    );
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'De Nissan lo más cercano es el Sentra.',
        meta: { vehiculo: null },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'que sea diésel',
    });

    expect(result?.reply.meta.vehiculo).toBeNull();
    expect(catalog.listAvailableExcept).not.toHaveBeenCalled();
    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('No pases a otra marca'),
      }),
    );
  });

  it('si ninguno cumple no manda el carro de otra marca', async () => {
    conversation.loadVehicleBrand.mockResolvedValue('nissan');
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'sentra',
        brand: 'nissan',
        model: 'sentra exclusive ac 1.8 4p 4x2 ta',
        year: 2014,
        price: 13800,
        typeBody: 'sedan',
      },
    ]);
    openai.completeJson.mockResolvedValue(JSON.stringify({ cumplen: [] }));
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Tenemos un Santa Fe.',
        meta: { vehiculo: { inventory_id: 'santa-fe' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'que sea diésel',
    });

    expect(result?.reply.meta.vehiculo).toBeNull();
    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('No pases a otra marca'),
      }),
    );
  });

  it('un ok no vuelve a revisar ni a reenviar el mismo carro', async () => {
    conversation.loadConcreteAsk.mockResolvedValue('7 pasajeros');
    conversation.loadVehicleBrand.mockResolvedValue('nissan');
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'xtrail',
        brand: 'nissan',
        model: 'x-trail sense cvt ac 2.5 5p 4x2 ta',
        year: 2016,
        price: 16890,
        typeBody: 'jeep',
      },
    ]);
    openai.completeJson.mockResolvedValue(
      JSON.stringify({ cumplen: ['xtrail'] }),
    );
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Es la X-Trail.',
        meta: { vehiculo: null },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'ok',
    });

    expect(openai.completeJson).not.toHaveBeenCalled();
    expect(catalog.listByBrand).not.toHaveBeenCalled();
    expect(result?.reply.meta.vehiculo).toBeNull();
  });

  it('la simulación usa el último carro de interested_cars', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'exp-1',
      brand: 'ford',
      model: 'explorer xlt ac 3.5 5p 4x4',
      year: 2018,
      price: 33990,
    });
    openai.complete
      .mockResolvedValueOnce('RESUMEN\nCliente pide simulación.')
      .mockResolvedValueOnce('{"intenciones":["financiamiento"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'La cuota de la Explorer queda en este valor.',
        meta: { vehiculo: { inventory_id: 'exp-1' } },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'Este vehiculo',
    });

    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('precio_interno=33990'),
        user: expect.stringContaining('No vuelvas a pedir'),
      }),
    );
    expect(openai.runSalesAgent.mock.calls[0][0].system).not.toContain('$33990');
  });

  it('si pide el precio sí se lo muestra', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'exp-1',
      brand: 'ford',
      model: 'explorer xlt ac 3.5 5p 4x4',
      year: 2018,
      price: 33990,
    });
    openai.complete
      .mockResolvedValueOnce('RESUMEN\nCliente quiere el precio.')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'La Explorer está en $33990.',
        meta: {
          precio_mostrado: true,
          cuota_mostrada: false,
          vehiculo: { inventory_id: 'exp-1', precio: 33990 },
        },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'el precio x favor',
    });

    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('$33990'),
      }),
    );
    expect(persistence.appendChatHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        ai: expect.stringContaining('"precio_mostrado":true'),
      }),
    );
  });

  it('una camioneta no manda el suv de esa marca', async () => {
    conversation.loadVehicleKind.mockResolvedValue('camioneta');
    conversation.loadVehicleBrand.mockResolvedValue('nissan');
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'kicks',
        brand: 'nissan',
        model: 'kicks exclusive',
        year: 2020,
        price: 18900,
        typeBody: 'jeep',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Le muestro la Kicks.',
        meta: { vehiculo: { inventory_id: 'kicks' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'quiero una camioneta',
    });

    expect(openai.completeJson).not.toHaveBeenCalled();
    expect(result?.reply.meta.vehiculo).toBeNull();
    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('no hay camioneta'),
      }),
    );
  });

  it('el carro de interés en doble cabina filtra la búsqueda como camioneta', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'dmax-1',
      brand: 'chevrolet',
      model: 'd-max crdi 3.0 cd',
      year: 2016,
      price: 22000,
      typeBody: 'doble cabina',
    });
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.embed.mockResolvedValue([0.2]);
    catalog.searchInventory.mockResolvedValue('[]');
    openai.runSalesAgent.mockImplementation(
      async (input: {
        executeTool: (name: string, argsJson: string) => Promise<string>;
      }) => {
        await input.executeTool(
          'buscarvehiuclo',
          JSON.stringify({ query: 'd-max 2014' }),
        );
        return JSON.stringify({
          respuesta_cliente: 'Reviso las D-MAX.',
          meta: { vehiculo: null },
        });
      },
    );

    await service.handleTurn({
      contactId: '1',
      customerText: '¿Una D-MAX del 2015 o 2014, algo más económico?',
    });

    expect(conversation.saveVehicleKind).toHaveBeenCalledWith('1', 'camioneta');
    expect(catalog.searchInventory).toHaveBeenCalledWith(
      [0.2],
      'camioneta',
      null,
      false,
    );
  });

  it('un gracias no cierra y pide seguir con el vehículo', async () => {
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content: 'Tenemos una Nissan X-Trail 2016 en $16890.',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN\nCliente agradece.')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: '¿Le preparo el financiamiento de la X-Trail?',
        meta: { vehiculo: null },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'Muchas gracias por su atención y comunicación.',
    });

    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('NO ES DESPEDIDA'),
        user: expect.stringContaining('financiamiento o visita'),
      }),
    );
  });
});
