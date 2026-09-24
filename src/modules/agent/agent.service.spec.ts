import { AgentService } from './agent.service';
import { TEST_LEXICON } from '../conversation/test-lexicon';

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
    catalog.listByBrand.mockResolvedValue([]);
    catalog.listAvailableExcept.mockReset();
    catalog.listAvailableExcept.mockResolvedValue([]);
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

  it('clic de Facebook sin carro pregunta cuál y no lista', async () => {
    const result = await service.handleTurn({
      contactId: '59099901',
      customerText: '¡Hola! Quiero más información',
    });

    expect(result?.reply.mensaje).toBe('Claro. ¿Qué carro le interesa?');
    expect(result?.reply.meta.vehiculo).toBeNull();
    expect(openai.complete).not.toHaveBeenCalled();
    expect(openai.runSalesAgent).not.toHaveBeenCalled();
    expect(conversation.appendMessage).toHaveBeenCalledWith('59099901', {
      role: 'assistant',
      content: 'Claro. ¿Qué carro le interesa?',
    });
  });

  it('clic de Facebook con botón no usa ese título como carro', async () => {
    const result = await service.handleTurn({
      contactId: '56671451',
      customerText:
        '¡Hola! Me gustaría conseguir más información sobre esto {Chatea con nosotros}',
    });

    expect(result?.reply.mensaje).toBe('Claro. ¿Qué carro le interesa?');
    expect(openai.runSalesAgent).not.toHaveBeenCalled();
  });

  it('clic de Facebook con carro del anuncio manda esa unidad', async () => {
    openai.complete
      .mockResolvedValueOnce('RESUMEN\nPide el Fiat 500 del anuncio.')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Tenemos un Fiat 500 2017 disponible.',
        meta: { vehiculo: null },
      }),
    );

    await service.handleTurn({
      contactId: '59082581',
      customerText:
        'Hola. ¿Puedo obtener más información sobre esto {Fiat 500 2017}',
    });

    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.stringContaining('ANUNCIO DE FACEBOOK'),
      }),
    );
    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.stringContaining('Fiat 500 2017'),
      }),
    );
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

  it('intención no carga filas inventadas de agent_prompts', async () => {
    catalog.listAgentPromptNames.mockResolvedValue([
      'rol',
      'compra',
      'manejocaro',
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN\nCliente quiere una hilux.')
      .mockResolvedValueOnce(
        '{"intenciones":["compra","consulta_modelo"]}',
      );
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Tenemos una Hilux disponible.',
        meta: { vehiculo: { inventory_id: 'inv-1' } },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'me interesa una hilux',
    });

    expect(openai.complete.mock.calls[1][0]).toMatch(/Filas REALES de agent_prompts/);
    expect(openai.complete.mock.calls[1][0]).toMatch(/- compra/);
    expect(openai.complete.mock.calls[1][0]).not.toMatch(/consulta_modelo/);
    expect(catalog.fetchAgentPrompts).toHaveBeenCalledWith(['rol', 'compra']);
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
        system: expect.stringMatching(/ranger xlt/i),
      }),
    );
    expect(result?.reply.meta.vehiculo).toBeNull();
  });

  it('en 18 ni lo deja es precio y no horario', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'b7d3649a-c700-4070-b4e2-21289a45b330',
      brand: 'hyundai',
      model: 'creta ac 1.5 5p 4x2 tm',
      year: 2022,
      price: 22990,
      typeBody: 'jeep',
    });
    openai.complete
      .mockResolvedValueOnce('RESUMEN\nCliente habla de contado.')
      .mockResolvedValueOnce('{"intenciones":["contado"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Después de las 18:00 no atendemos.',
        meta: {
          vehiculo: { inventory_id: 'b7d3649a-c700-4070-b4e2-21289a45b330' },
        },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'En 18 ni lo deja',
    });

    expect(openai.runSalesAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('15000'),
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

  it('si ya mostramos el Sportage automático el precio no salta a otro', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'plata-1',
      brand: 'kia',
      model: 'sportage r gti 2019 ta',
      year: 2019,
      price: 22900,
      typeBody: 'jeep',
    });
    conversation.loadVehicleBrand.mockResolvedValue('kia');
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'rojo-1',
        brand: 'kia',
        model: 'sportage r gti 2019 ta',
        year: 2019,
        price: 22900,
        typeBody: 'jeep',
      },
      {
        id: 'plata-1',
        brand: 'kia',
        model: 'sportage r gti 2019 ta',
        year: 2019,
        price: 21900,
        typeBody: 'jeep',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente quiere el precio.\nPide precio: sí',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Lo más cercano es el rojo.',
        meta: { vehiculo: { inventory_id: 'rojo-1' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Cual es el precio d este automático',
    });

    expect(result?.reply.meta.vehiculo).toEqual({
      inventory_id: 'plata-1',
      precio: 22900,
    });
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toContain('inventory_id=plata-1');
    expect(system).toMatch(/HILO SIGUE|YA MOSTRAMOS/i);
    expect(system).not.toMatch(/PRIMERO dilo/i);
    expect(catalog.listByBrand).not.toHaveBeenCalled();
  });

  it('si pide Premiere 2020 no se queda en la D-Max 2022', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'dmax-vino-2022',
      brand: 'chevrolet',
      model: 'd-max crdi 2.5 cd 4x4 tm diesel',
      year: 2022,
      price: 28900,
      typeBody: 'camioneta',
      color: 'vino',
    });
    conversation.loadVehicleBrand.mockResolvedValue('chevrolet');
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'dmax-2020-cs',
        brand: 'chevrolet',
        model: 'd-max crdi 2.5 cs 4x2 tm diesel',
        year: 2020,
        price: 21900,
        typeBody: 'camioneta',
        color: 'blanco',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'RESUMEN PREVIO:\nVehículo: D-Max 2022 vino\nSOLICITUD ACTUAL:\nCliente busca la Premiere 2020.',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'No tenemos Premier 2020. Tenemos una D-Max 2020.',
        meta: { vehiculo: { inventory_id: 'dmax-2020-cs' } },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'estoy buscando la premiere 2020',
    });

    expect(catalog.listByBrand).toHaveBeenCalledWith('chevrolet');
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).not.toMatch(/EL HILO SIGUE CON/i);
    expect(system).toMatch(/No hay Premier 2020|no tenemos Premier 2020/i);
    expect(system).toContain('dmax-2020-cs');
  });

  it('después de mostrar un carro un mensaje suelto no reabre inventario', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'plata-1',
      brand: 'kia',
      model: 'sportage r gti 2019 ta',
      year: 2019,
      price: 22900,
      typeBody: 'jeep',
    });
    conversation.recentMessages.mockResolvedValue([
      { role: 'assistant', content: 'Le mandé las fotos del Sportage plateado.' },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'RESUMEN PREVIO:\nVehículo: Sportage plateado\nSOLICITUD ACTUAL:\nCliente quiere saber si tiene cámara.',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Sí, el plateado tiene cámara.',
        meta: { vehiculo: { inventory_id: 'rojo-1' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'y tiene cámara de reversa?',
    });

    expect(catalog.listByBrand).not.toHaveBeenCalled();
    expect(result?.reply.meta.vehiculo).toEqual({
      inventory_id: 'plata-1',
      precio: 22900,
    });
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toContain('inventory_id=plata-1');
    expect(system).toMatch(/HILO SIGUE/i);
  });

  it('el km no se manda como placa ni inventa MAX', async () => {
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'dmax-2023',
        brand: 'chevrolet',
        model: 'd-max crdi 2.5 cd 4x2 tm diesel',
        year: 2023,
        price: 28990,
        typeBody: 'camioneta',
        color: 'plateado',
        mileage: 77613,
        transmission: 'manual',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente quiere la D-max 2023 y solicita fotos.\nPide precio: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'Estimado, tenemos disponible un Chevrolet D-max MAX 2023 color plateado, con 77613 km, transmisión manual y tracción 4x2. La placa es 77613. Aquí tiene también las fotos del vehículo.',
        meta: { vehiculo: { inventory_id: 'dmax-2023' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Hola. Me interesa el Chevrolet D-max CRDI 2023',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/d-max crdi 2\.5 cd 4x2 tm diesel/i);
    expect(system).toMatch(/sin plate_short/i);
    expect(system).not.toMatch(/D-max MAX/i);
    expect(result?.reply.mensaje).not.toMatch(/placa/i);
    expect(result?.reply.mensaje).not.toMatch(/La placa es 77613/i);
    expect(result?.reply.mensaje).toMatch(/77613 km/i);
  });

  it('no manda el primer bloque hex del inventory_id como placa', async () => {
    catalog.listByBrand.mockResolvedValue([
      {
        id: '62434e00-aaaa-4bbb-8ccc-ddddeeeeffff',
        brand: 'nissan',
        model: 'x-trail sense cvt ac 2.5 5p 4x2 ta',
        year: 2016,
        price: 16890,
        typeBody: 'jeep',
        color: 'azul',
        mileage: 144904,
        transmission: 'automática',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente quiere el X-Trail 2016 y solicita fotos.\nPide precio: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'Estimado, tenemos disponible un Nissan X-Trail TRAIL 2016 color azul. La placa es 62434e00. Aquí tiene también las fotos del vehículo.',
        meta: {
          vehiculo: { inventory_id: '62434e00-aaaa-4bbb-8ccc-ddddeeeeffff' },
        },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Me interesa el Nissan X-Trail 2016',
    });

    expect(result?.reply.mensaje).not.toMatch(/62434e00/i);
    expect(result?.reply.mensaje).not.toMatch(/placa/i);
  });

  it('no manda el inventory_id como si fuera la placa', async () => {
    catalog.listByBrand.mockResolvedValue([
      {
        id: '61d90585-7047-4db8-bb7f-1cf9f2ced204',
        brand: 'toyota',
        model: 'hilux sr 4x4',
        year: 2023,
        price: 33900,
        typeBody: 'camioneta',
        color: 'plateado',
        mileage: 13086,
        transmission: 'manual',
        plateShort: '61d90585-7047-4db8-bb7f-1cf9f2ced204',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente quiere la Hilux 2023 4x4 y solicita fotos.\nPide precio: sí',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'Estimado, tenemos disponible una Toyota Hilux SR 2023 color plateado, con 13086 km, transmisión manual y 4x4. La placa es 61d90585-7047-4db8-bb7f-1cf9f2ced204.',
        meta: {
          vehiculo: { inventory_id: '61d90585-7047-4db8-bb7f-1cf9f2ced204' },
        },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Hola, me interesa la Toyota Hillux 2023 4x4',
    });

    expect(result?.reply.mensaje).toMatch(/Hilux SR 2023/i);
    expect(result?.reply.mensaje).not.toMatch(/61d90585/i);
    expect(result?.reply.mensaje).not.toMatch(/placa/i);
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).not.toMatch(/plate_short=61d90585/i);
  });

  it('quita una placa larga inventada aunque la presente por primera vez', async () => {
    openai.complete
      .mockResolvedValueOnce('RESUMEN\nCliente quiere la 4Runner.')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'Estimado, tenemos un Toyota 4Runner 2004. La placa es JYQ-3454. Aquí tiene las fotos.',
        meta: { vehiculo: { inventory_id: 'f5526c6e-4500-4aaf-af0e-be667203e0a0' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Hola. ¿Puedo obtener más información sobre esto?',
    });

    expect(result?.reply.mensaje).not.toMatch(/JYQ/i);
    expect(result?.reply.mensaje).not.toMatch(/3454/);
    expect(result?.reply.mensaje).toMatch(/4Runner/i);
  });

  it('si pregunta km se queda en ese carro y no suelta la placa', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'xtrail-2016',
      brand: 'nissan',
      model: 'x-trail sense cvt ac 2.5 5p 4x2 ta',
      year: 2016,
      price: 16890,
      typeBody: 'jeep',
      mileage: 144904,
      plateShort: 'L5',
    });
    openai.complete
      .mockResolvedValueOnce(
        'RESUMEN PREVIO:\nVehículo: X-Trail 2016\nSOLICITUD ACTUAL:\nCliente quiere el kilometraje.',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'El Nissan X-Trail 2016 tiene 144904 km. La placa es L5.',
        meta: { vehiculo: { inventory_id: 'xtrail-2016' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'CUANTOS KM ??????',
    });

    expect(catalog.listByBrand).not.toHaveBeenCalled();
    expect(result?.reply.mensaje).toMatch(/144904/);
    expect(result?.reply.mensaje).not.toMatch(/placa/i);
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toContain('km=144904');
    expect(system).toMatch(/resumen y el HISTORIAL/i);
  });

  it('Cuánto pide el precio de la unidad que ya mostramos', async () => {
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content: 'Tenemos el Optra 2012 vino disponible. Aquí las fotos.',
      },
    ]);
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'optra-1',
      brand: 'chevrolet',
      model: 'optra advance 1.8l 4p tm',
      year: 2012,
      price: 10900,
      typeBody: 'sedan',
    });
    openai.complete
      .mockResolvedValueOnce(
        'RESUMEN PREVIO:\nVehículo: Optra 2012 vino\nSOLICITUD ACTUAL:\nCliente quiere el precio.\nPide precio: sí',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'El Optra 2012 está en $10900.',
        meta: { vehiculo: { inventory_id: 'optra-1', precio: 10900 } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Cuánto',
    });

    expect(result?.reply.mensaje).toMatch(/10900/);
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toContain('$10900');
    expect(system).toMatch(/YA SE DIO LA FICHA/i);
    expect(system).toMatch(/justifica el valor/i);
    expect(system).toMatch(/Prohibido placa, cuota, cédula/i);
  });

  it('precio y ciudad: sale el valor y no el mecánico', async () => {
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content:
          'Estimado, tenemos disponible un Kia Seltos ex ac 1.6 5p 4x2 año 2020 color plomo, con 78159 km. Aquí tiene también las fotos del vehículo.',
      },
    ]);
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'seltos-1',
      brand: 'kia',
      model: 'seltos ex ac 1.6 5p 4x2 ta',
      year: 2020,
      price: 19990,
      typeBody: 'jeep',
      color: 'plomo',
      mileage: 78159,
    });
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente quiere el precio y uno en Cuenca.\nPide precio: sí',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'Este Kia Seltos 2020 color plomo Está en Cuenca, con papeles en regla. El kilometraje es acorde al año, es un carro cuidado y en buen estado; puede traer a su mecánico para revisar.',
        meta: { vehiculo: { inventory_id: 'seltos-1' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Cuál es el precio\nUno acá en cuenca',
    });

    expect(result?.reply.mensaje).toMatch(/19,990|19990/);
    expect(result?.reply.mensaje).toMatch(/Cuenca/i);
    expect(result?.reply.mensaje).not.toMatch(/mecánico/i);
  });

  it('Q vale pide el precio de esa unidad y no repite la placa', async () => {
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content: 'Tenemos el Optra 2012 disponible. Aquí las fotos.',
      },
    ]);
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'optra-1',
      brand: 'chevrolet',
      model: 'optra advance 1.8l 4p tm',
      year: 2012,
      price: 10900,
      typeBody: 'sedan',
      plateShort: 'H7',
    });
    openai.complete
      .mockResolvedValueOnce(
        'RESUMEN PREVIO:\nVehículo: Optra 2012\nSOLICITUD ACTUAL:\nCliente quiere el precio.',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'El Optra 2012 está en $10900. La placa es H7. ¿Le armo la cuota?',
        meta: { vehiculo: { inventory_id: 'optra-1', precio: 10900 } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Q vale',
    });

    expect(catalog.listByBrand).not.toHaveBeenCalled();
    expect(result?.reply.mensaje).toMatch(/10900/);
    expect(result?.reply.mensaje).not.toMatch(/placa/i);
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toContain('$10900');
    expect(system).toMatch(/YA SE DIO LA FICHA/i);
  });

  it('Valor del Seltos pide el precio y no cédula ni placa', async () => {
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content: 'Tenemos el Seltos 2020 disponible. Aquí las fotos.',
      },
    ]);
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'seltos-1',
      brand: 'kia',
      model: 'seltos 2020',
      year: 2020,
      price: 19990,
      typeBody: 'jeep',
      plateShort: 'P7',
    });
    openai.complete
      .mockResolvedValueOnce('RESUMEN\nCliente quiere el valor.')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'La placa es P7. ¿Me pasa su cédula para la simulación?',
        meta: { vehiculo: { inventory_id: 'seltos-1' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Valor del kia seltos',
    });

    expect(result?.reply.mensaje).not.toMatch(/placa/i);
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toContain('$19990');
    expect(system).toMatch(/YA SE DIO LA FICHA/i);
    expect(system).toMatch(/Prohibido placa, cuota, cédula/i);
  });

  it('Jetour blanco 2023 elige esa unidad para poder mandar fotos', async () => {
    catalog.listByBrand.mockResolvedValue([
      {
        id: 't1-2026',
        brand: 'jetour',
        model: 't1 ac 2.0 5p 4x4 ta',
        year: 2026,
        price: 28900,
        typeBody: 'suv',
        color: 'blanco',
      },
      {
        id: 'x70-2023',
        brand: 'jetour',
        model: 'x70 ii ac 1.5 5p 4x2 tm',
        year: 2023,
        price: 18900,
        typeBody: 'suv',
        color: 'blanco',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Le paso la Jetour X70 2023 blanca.',
        meta: { vehiculo: { inventory_id: 'x70-2023' } },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'El jeptour\nBlanco 2023\nAyúdeme con fotos\nRecorrido\nPrecio',
    });

    expect(catalog.listByBrand).toHaveBeenCalledWith('jetour');
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toContain('x70-2023');
    expect(system).toMatch(/SÍ está en patio/i);
  });

  it('Chevrolet Grand Vitara 2008 se presenta si está en patio', async () => {
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'chevy-vitara-2008',
        brand: 'chevrolet',
        model: 'grand vitara 3p tm ac sport',
        year: 2008,
        price: 11900,
        typeBody: 'suv',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Tenemos la Grand Vitara 2008.',
        meta: { vehiculo: { inventory_id: 'chevy-vitara-2008' } },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText:
        'me interesa su auto Chevrolet Grand Vitara 3P Sport 2008. Lo vi en PATIOTuerca',
    });

    expect(catalog.listByBrand).toHaveBeenCalledWith('chevrolet');
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toContain('chevy-vitara-2008');
    expect(system).toMatch(/SÍ está en patio/i);
    expect(system).not.toMatch(/No hay Vitara 2008/i);
  });

  it('si pide Aveo y no hay, lo dice y no lo presenta como Optra', async () => {
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'optra-1',
        brand: 'chevrolet',
        model: 'optra advance 1.8l 4p tm',
        year: 2012,
        price: 10900,
        typeBody: 'sedan',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Tenemos el Optra.',
        meta: { vehiculo: { inventory_id: 'optra-1' } },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'Aveo\nChebrolec',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(catalog.listByBrand).toHaveBeenCalledWith('chevrolet');
    expect(system).toMatch(/no tenemos Aveo/i);
    expect(system).toContain('inventory_id=optra-1');
  });

  it('El automático elige la unidad que ya listamos, no otra', async () => {
    conversation.loadVehicleBrand.mockResolvedValue('kia');
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content:
          'Tenemos un Sportage 2019 negro manual, un Sportage 2019 rojo manual, un Sportage 2019 plateado automático y un Sportage 2024 plomo manual.',
      },
    ]);
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'negro-tm',
        brand: 'kia',
        model: 'sportage sl 2019 tm',
        year: 2019,
        price: 20000,
        typeBody: 'jeep',
      },
      {
        id: 'plata-ta',
        brand: 'kia',
        model: 'sportage gti 2019 ta',
        year: 2019,
        price: 21900,
        typeBody: 'jeep',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'El plateado automático.',
        meta: { vehiculo: { inventory_id: 'negro-tm' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'El automático\nMe interesa',
    });

    expect(result?.reply.meta.vehiculo).toEqual({
      inventory_id: 'plata-ta',
    });
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toContain('inventory_id=plata-ta');
    expect(system).toMatch(/YA le mostramos/i);
  });

  it('La 2018 elige la Explorer que ya listamos, no la Lariat', async () => {
    conversation.loadVehicleBrand.mockResolvedValue('ford');
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'escape-1',
      brand: 'ford',
      model: 'escape titanium',
      year: 2023,
      price: 28900,
      typeBody: 'jeep',
    });
    conversation.recentMessages.mockResolvedValue([
      { role: 'user', content: 'Quiero un explorer +/- 2017' },
      {
        role: 'assistant',
        content:
          'No tenemos una Explorer 2017. Pero puedo ofrecerle una Explorer XLT 1998 blanca 4x4 o una Explorer XLT 2018 blanca automática 4x4.',
      },
    ]);
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'exp-1998',
        brand: 'ford',
        model: 'explorer xlt 4x4',
        year: 1998,
        price: 8900,
        typeBody: 'jeep',
        color: 'blanco',
      },
      {
        id: 'exp-2018',
        brand: 'ford',
        model: 'explorer xlt ac 3.5 5p 4x4 ta',
        year: 2018,
        price: 23900,
        typeBody: 'jeep',
        color: 'blanco',
      },
      {
        id: 'lariat-2018',
        brand: 'ford',
        model: 'f-150 lariat 5.0 4x4',
        year: 2018,
        price: 32900,
        typeBody: 'doble cabina',
        color: 'cafe',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente quiere la Explorer 2018.\nPide precio: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'La Explorer 2018 blanca.',
        meta: { vehiculo: { inventory_id: 'exp-2018' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'La 2018',
    });

    expect(result?.reply.meta.vehiculo).toEqual({
      inventory_id: 'exp-2018',
    });
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toContain('inventory_id=exp-2018');
    expect(system).not.toMatch(/lariat|f-150|F150/i);
    expect(system).toMatch(/YA le mostramos/i);
  });

  it('Explorer después de elegir 2018 no reabre la 1998', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'exp-2018',
      brand: 'ford',
      model: 'explorer xlt ac 3.5 5p 4x4 ta',
      year: 2018,
      price: 23900,
      typeBody: 'jeep',
      color: 'blanco',
    });
    conversation.recentMessages.mockResolvedValue([
      { role: 'user', content: 'La 2018' },
      {
        role: 'assistant',
        content: 'La Explorer XLT 2018 blanca automática 4x4.',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente sigue con la Explorer 2018.\nPide precio: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Le paso la ubicación para ver la Explorer 2018.',
        meta: { vehiculo: { inventory_id: 'exp-2018' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Explorer',
    });

    expect(catalog.listByBrand).not.toHaveBeenCalled();
    expect(result?.reply.meta.vehiculo).toEqual({
      inventory_id: 'exp-2018',
      precio: 23900,
    });
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/HILO SIGUE|YA MOSTRAMOS/i);
    expect(system).not.toMatch(/1998/);
  });

  it('Sportage en el mismo texto que Hyundai no se declara agotado', async () => {
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'sportage-1',
        brand: 'kia',
        model: 'sportage r gti lx ac 2.0 5p 4x2 ta',
        year: 2019,
        price: 22200,
        typeBody: 'jeep',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'No tenemos Sportage.',
        meta: { vehiculo: null },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText:
        'Hola. Quiero más información sobre el Kia Sportage 2019\nTiene en Hyundai ix\nSí, por favor',
    });

    expect(catalog.listByBrand).toHaveBeenCalledWith('kia');
    expect(result?.reply.meta.vehiculo).toEqual({
      inventory_id: 'sportage-1',
    });
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/SÍ está en patio/i);
    expect(system).not.toMatch(/no tenemos Sportage/i);
  });

  it('si no hay Tucson lo dice y después ofrece otra Hyundai', async () => {
    conversation.loadVehicleBrand.mockResolvedValue('hyundai');
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'kona-1',
        brand: 'hyundai',
        model: 'kona gls ac 1.6 5p',
        year: 2022,
        price: 21990,
        typeBody: 'jeep',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Tenemos un Kona.',
        meta: { vehiculo: { inventory_id: 'kona-1' } },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'Tucson',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/no tenemos Tucson/i);
    expect(system).toContain('inventory_id=kona-1');
  });

  it('si el listado no trae el modelo el embedding lo usa y no dice que no hay', async () => {
    conversation.loadVehicleBrand.mockResolvedValue('kia');
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'picanto-1',
        brand: 'kia',
        model: 'picanto lx ac 1.2',
        year: 2023,
        price: 15990,
        typeBody: 'sedan',
      },
    ]);
    openai.embed.mockResolvedValue([0.4]);
    catalog.searchByQuery.mockResolvedValue(
      JSON.stringify([
        {
          id: 'sportage-1',
          content: 'kia sportage r gti 2019 plateado',
          metadata: {
            brand: 'kia',
            model: 'sportage r gti lx ac 2.0 5p 4x2 ta',
            year: 2019,
            type: 'jeep',
            inventory_id: 'sportage-1',
            price: 22900,
          },
        },
      ]),
    );
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'No tenemos Sportage.',
        meta: { vehiculo: null },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'tienen el Sportage?',
    });

    expect(catalog.searchByQuery).toHaveBeenCalledWith({
      embedding: [0.4],
      query: 'tienen el Sportage?',
      tipo: null,
      marca: 'kia',
      includePrice: false,
    });
    expect(result?.reply.meta.vehiculo).toEqual({
      inventory_id: 'sportage-1',
    });
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/SÍ está en patio/i);
    expect(system).not.toMatch(/no tenemos Sportage/i);
  });

  it('Hilux 4x2 gasolina 2023+ va al embedding y presenta la más cercana', async () => {
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'hilux-2023',
        brand: 'toyota',
        model: 'hilux sr 2.7 cd 4x4 tm',
        year: 2023,
        price: 48990,
        typeBody: 'doble cabina',
        color: 'plateado',
        mileage: 13086,
        fuelType: 'gas',
        plateShort: 'P9',
      },
      {
        id: 'hilux-2026',
        brand: 'toyota',
        model: 'hilux 2.4 cd 4x4 tm diesel',
        year: 2026,
        price: 0,
        typeBody: 'doble cabina',
        color: 'plomo',
        fuelType: 'die',
        plateShort: 'U9',
      },
    ]);
    openai.embed.mockResolvedValue([0.2]);
    catalog.searchByQuery.mockResolvedValue(
      JSON.stringify([
        {
          id: 'hilux-2023',
          metadata: {
            brand: 'toyota',
            model: 'hilux sr 2.7 cd 4x4 tm',
            year: 2023,
            type: 'doble cabina',
            inventory_id: 'hilux-2023',
          },
        },
      ]),
    );
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente busca Hilux cabina doble gasolina 4x2 2023 en adelante.',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'Tenemos una Hilux SR 2023 cabina doble a gasolina, es 4x4. Aquí las fotos.',
        meta: { vehiculo: { inventory_id: 'hilux-2023' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText:
        'Toyota Hilux cabina doble a gasolina, 4x2 año 2023 en adelante',
    });

    expect(openai.embed).toHaveBeenCalled();
    expect(catalog.searchByQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        query:
          'Toyota Hilux cabina doble a gasolina, 4x2 año 2023 en adelante',
        marca: 'toyota',
      }),
    );
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/más cercanas/i);
    expect(system).toMatch(/hilux sr 2\.7 cd 4x4 tm/i);
    expect(system).not.toMatch(/No hay Hilux/i);
    expect(result?.reply.meta.vehiculo).toEqual({
      inventory_id: 'hilux-2023',
    });
  });

  it('Hilux suelta el SUV anterior y no ofrece un Prado', async () => {
    conversation.loadVehicleBrand.mockResolvedValue('volkswagen');
    conversation.loadVehicleKind.mockResolvedValue('suv');
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'tcross-1',
      brand: 'volkswagen',
      model: 't-cross comfortline',
      year: 2024,
      price: 24990,
      typeBody: 'jeep',
    });
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'hilux-1',
        brand: 'toyota',
        model: 'hilux cd 2.4 4x4 tm diesel',
        year: 2021,
        price: 32990,
        typeBody: 'doble cabina',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'No tenemos Hilux manual en SUV.',
        meta: { vehiculo: { inventory_id: 'tcross-1' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Hilux Manuel',
    });

    expect(catalog.listByBrand).toHaveBeenCalledWith('toyota');
    expect(result?.reply.meta.vehiculo).toEqual({ inventory_id: 'hilux-1' });
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toContain('inventory_id=hilux-1');
    expect(system).toContain('Tipo: camioneta');
    expect(system).not.toContain('Tipo: suv');
    expect(system).toContain('CAJA VIGENTE: manual');
  });

  it('si pide Prado no dice que no hay ni salta a otra marca por caja vieja', async () => {
    conversation.loadVehicleBrand.mockResolvedValue('toyota');
    conversation.loadVehicleKind.mockResolvedValue('suv');
    conversation.loadGearbox.mockResolvedValue('automatica');
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'sportage-1',
      brand: 'kia',
      model: 'sportage sl ac 2.0',
      year: 2019,
      price: 22200,
      typeBody: 'jeep',
    });
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'prado-1',
        brand: 'toyota',
        model: 'prado txl ac 2.7 5p 4x4 tm',
        year: 2018,
        price: 38990,
        typeBody: 'jeep',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'El Prado automático no está disponible.',
        meta: { vehiculo: { inventory_id: 'sportage-1' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Hola. Me interesa el Toyota Land Cruiser Prado',
    });

    expect(result?.reply.meta.vehiculo).toEqual({ inventory_id: 'prado-1' });
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toContain('inventory_id=prado-1');
    expect(system).toMatch(/SÍ está en patio/i);
    expect(system).not.toContain('CAJA VIGENTE');
    expect(system).toContain('CAMBIO DE MODELO');
  });

  it('si pide otro modelo no se queda en el Seltos ni reusa la caja', async () => {
    conversation.loadVehicleBrand.mockResolvedValue('kia');
    conversation.loadVehicleKind.mockResolvedValue('suv');
    conversation.loadGearbox.mockResolvedValue('automatica');
    conversation.loadConcreteAsk.mockResolvedValue(
      'Está bonito el seltos pero es automático',
    );
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'seltos-1',
      brand: 'kia',
      model: 'seltos 2020',
      year: 2020,
      price: 19990,
      typeBody: 'jeep',
    });
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'seltos-1',
        brand: 'kia',
        model: 'seltos 2020',
        year: 2020,
        price: 19990,
        typeBody: 'jeep',
      },
      {
        id: 'rio-1',
        brand: 'kia',
        model: 'rio lx ac 1.4 4p',
        year: 2018,
        price: 12990,
        typeBody: 'sedan',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'El Kia Rio 2018 está disponible.',
        meta: { vehiculo: { inventory_id: 'seltos-1' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Kia rio ?',
    });

    expect(result?.reply.meta.vehiculo).toEqual({ inventory_id: 'rio-1' });
    expect(conversation.clearGearbox).toHaveBeenCalledWith('1');
    expect(conversation.clearConcreteAsk).toHaveBeenCalledWith('1');
    expect(conversation.saveVehicleKind).toHaveBeenCalledWith('1', 'sedan');
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toContain('inventory_id=rio-1');
    expect(system).toContain('CAMBIO DE MODELO');
    expect(system).not.toContain('CAJA VIGENTE');
    expect(system).not.toContain('Tipo: suv');
    expect(system).toContain('Tipo: sedan');
  });

  it('Río con tilde también cambia del Seltos al Rio', async () => {
    conversation.loadVehicleBrand.mockResolvedValue('kia');
    conversation.loadVehicleKind.mockResolvedValue('suv');
    conversation.loadGearbox.mockResolvedValue('automatica');
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'seltos-1',
      brand: 'kia',
      model: 'seltos 2020',
      year: 2020,
      price: 19990,
      typeBody: 'jeep',
    });
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'seltos-1',
        brand: 'kia',
        model: 'seltos 2020',
        year: 2020,
        price: 19990,
        typeBody: 'jeep',
      },
      {
        id: 'rio-1',
        brand: 'kia',
        model: 'rio lx ac 1.4 4p',
        year: 2018,
        price: 12990,
        typeBody: 'sedan',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce('RESUMEN')
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'El Kia Seltos sigue disponible.',
        meta: { vehiculo: { inventory_id: 'seltos-1' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Río ?',
    });

    expect(result?.reply.meta.vehiculo).toEqual({ inventory_id: 'rio-1' });
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
    catalog.searchByQuery.mockResolvedValue('[]');
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
    expect(catalog.searchByQuery).toHaveBeenCalledWith({
      embedding: [0.1, 0.2],
      query: 'poer',
      tipo: null,
      marca: 'great wall',
      includePrice: false,
    });
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
    catalog.searchByQuery.mockResolvedValue('[]');
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

    expect(catalog.searchByQuery).toHaveBeenCalledWith({
      embedding: [0.3],
      query: 'financiamiento camioneta',
      tipo: 'camioneta',
      marca: null,
      includePrice: false,
    });
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
        system: expect.stringMatching(/lo más parecido/i),
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
        user: expect.stringContaining('interested_cars'),
      }),
    );
    expect(openai.runSalesAgent.mock.calls[0][0].system).not.toContain('$33990');
  });

  it('si pide el precio sí se lo muestra', async () => {
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content:
          'Tenemos la Explorer 2018 disponible. Aquí tiene también las fotos.',
      },
    ]);
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
    catalog.searchByQuery.mockResolvedValue('[]');
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
    expect(catalog.searchByQuery).toHaveBeenCalledWith({
      embedding: [0.2],
      query: 'd-max 2014',
      tipo: null,
      marca: 'chevrolet',
      includePrice: false,
    });
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

  it('gracias con duda no cierra: contesta el malentendido', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'xtrail-2016',
      brand: 'nissan',
      model: 'x-trail sense cvt ac 2.5',
      year: 2016,
      price: 16890,
      typeBody: 'jeep',
    });
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente cree que no son de segunda.\nPide precio: no\nTiene duda: sí\nEs despedida: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Sí son seminuevos, de segunda.',
        meta: { vehiculo: { inventory_id: 'xtrail-2016' } },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'Ahí nomás grasias pence q eran de segunda',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/EL CLIENTE DEJÓ UNA DUDA/i);
    expect(system).not.toMatch(/EL CLIENTE AGRADECIÓ\. NO ES DESPEDIDA/i);
  });

  it('duda del km valida año, unidad y precio; no solo repite km', async () => {
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content:
          'Tenemos la Ranger XL 2024 plomo, con 11061 km. Aquí tiene las fotos.',
      },
    ]);
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'ranger-xl-2024',
      brand: 'ford',
      model: 'ranger xl ac 2.0 cd 4x2 tm diesel',
      year: 2024,
      price: 44590,
      typeBody: 'doble cabina',
      mileage: 11061,
      color: 'plomo',
    });
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente duda si 11000 km cuadra con el 2024; confirmar unidad y precio.\nPide precio: sí\nTiene duda: sí\nEs despedida: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'Sí, el Ranger XL 2024 tiene 11061 km, coherente para un seminuevo de ese año, y está en $44590.',
        meta: { vehiculo: { inventory_id: 'ranger-xl-2024', precio: 44590 } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Tiene 11000 km...',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/EL CLIENTE DEJÓ UNA DUDA/i);
    expect(system).toMatch(/km REAL/i);
    expect(system).toMatch(/PIDIÓ EL PRECIO/i);
    expect(system).toContain('km=11061');
    expect(system).toMatch(/km vs año/i);
    expect(system).toMatch(/15\.?000/i);
    expect(result?.reply.mensaje).toMatch(/44590/);
    expect(result?.reply.mensaje).toMatch(/11061/);
  });

  it('seguir en contacto no cierra la venta', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'ranger-xl-2024',
      brand: 'ford',
      model: 'ranger xl ac 2.0 cd 4x2 tm diesel',
      year: 2024,
      price: 44590,
      typeBody: 'doble cabina',
      mileage: 11061,
    });
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente sigue interesado pero no ahora.\nPide precio: no\nTiene duda: no\nEs despedida: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'De acuerdo, seguimos con el Ford Ranger XL 2024 cuando le quede bien.',
        meta: { vehiculo: { inventory_id: 'ranger-xl-2024' } },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'Ok. Seguimos en contacto',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/aún no quiere visita/i);
    expect(system).not.toMatch(/EL CLIENTE AGRADECIÓ\. NO ES DESPEDIDA/i);
    expect(system).not.toMatch(/EL CLIENTE DEJÓ UNA DUDA/i);
  });

  it('vender la casa para pagar al contado no pide un carro en toma', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'ranger-xl-2024',
      brand: 'ford',
      model: 'ranger xl ac 2.0 cd 4x2 tm diesel',
      year: 2024,
      price: 44590,
      typeBody: 'doble cabina',
      mileage: 11061,
    });
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente sigue con la Ranger 2024; comprará al contado cuando venda su casa.\nPide precio: no\nTiene duda: no\nEs despedida: no',
      )
      .mockResolvedValueOnce('{"intenciones":["venta","tomavehicular"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'De acuerdo, cuando venda la casa seguimos con la Ford Ranger XL 2024 al contado.',
        meta: { vehiculo: { inventory_id: 'ranger-xl-2024' } },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText:
        'Excelente pero estoy construyendo unas casa en Manta y espero vender para poder comprar al contado',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/NO es toma/i);
    expect(system).toMatch(/HILO SIGUE/i);
    expect(system).not.toMatch(/TOMA: el cliente nos está vendiendo SU vehículo/i);
  });

  it('furgoneta de 17-20 no ofrece Picanto ni camioneta', async () => {
    conversation.loadVehicleBrand.mockResolvedValue('kia');
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'picanto',
        brand: 'kia',
        model: 'picanto lx ac 1.2',
        year: 2023,
        price: 15990,
        typeBody: 'hatchback',
      },
      {
        id: 'sportage-1',
        brand: 'kia',
        model: 'sportage r gti',
        year: 2019,
        price: 22900,
        typeBody: 'jeep',
        passengerCapacity: '5',
      },
    ]);
    catalog.listAvailableExcept.mockResolvedValue([
      {
        id: 'hilux-1',
        brand: 'toyota',
        model: 'hilux cd 2.4',
        year: 2022,
        price: 32900,
        typeBody: 'doble cabina',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente quiere furgoneta o vehículo grande de 17 o 20 pasajeros.\nPide precio: no\nTiene duda: no\nEs despedida: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'No tenemos furgonetas de 17 o 20 pasajeros. Lo más grande es un Kia Sportage.',
        meta: { vehiculo: null },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText:
        'Por favor páseme los modelos de vehículos y furgonetas de 17 o 20 pasajeros',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/PEDIDO DE ESPACIO/i);
    expect(system).toContain('inventory_id=sportage-1');
    expect(system).not.toContain('picanto');
    expect(system).not.toContain('inventory_id=hilux');
    expect(system).toMatch(/PROHIBIDO ofrecer camioneta/i);
  });

  it('precio sin unidad confirmada no inventa un valor', async () => {
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente quiere el precio y dónde verlo.\nPide precio: sí\nTiene duda: no\nEs despedida: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'La dirección es Av. España. El precio del vehículo que menciona es $15,000.',
        meta: { vehiculo: null },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Precio y dónde le puedo ver',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/NO HAY UNIDAD CONFIRMADA/i);
    expect(system).toMatch(/PROHIBIDO inventar un precio/i);
    expect(result?.reply.mensaje).not.toMatch(/15[,.]?000/);
    expect(result?.reply.mensaje).toMatch(/España/i);
  });

  it('contado y crédito: da el precio y abre financiamiento', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'sportage-1',
      brand: 'kia',
      model: 'sportage r gti',
      year: 2019,
      price: 22900,
      typeBody: 'jeep',
    });
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente quiere precio de contado y a crédito.\nPide precio: sí\nPide crédito: sí\nTiene duda: no\nEs despedida: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra","financiamiento"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'El Sportage 2019 plateado está en $22900 de contado. Para crédito, ¿con cuánto de entrada y a qué plazo le gustaría?',
        meta: { vehiculo: { inventory_id: 'sportage-1', precio: 22900 } },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'Cuál es el precio de contado y a crédito por favor',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/CONTADO Y CRÉDITO/i);
    expect(system).toMatch(/entrada y plazo/i);
    expect(system).toMatch(/PIDIÓ CRÉDITO/i);
  });

  it('otro color: ofrece las otras Sportage y no repite el plateado', async () => {
    const sportages = [
      {
        id: 'sportage-1',
        brand: 'kia',
        model: 'sportage r gti',
        year: 2019,
        price: 22900,
        typeBody: 'jeep',
        color: 'plateado',
      },
      {
        id: 'sportage-rojo',
        brand: 'kia',
        model: 'sportage r gti',
        year: 2019,
        price: 22900,
        typeBody: 'jeep',
        color: 'rojo',
      },
      {
        id: 'sportage-plomo',
        brand: 'kia',
        model: 'sportage',
        year: 2024,
        price: 28900,
        typeBody: 'jeep',
        color: 'plomo',
      },
    ];
    catalog.listByBrand.mockResolvedValue(sportages);
    catalog.listAvailableExcept.mockResolvedValue(sportages);
    conversation.loadVehicleBrand.mockResolvedValue('kia');
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'sportage-1',
      brand: 'kia',
      model: 'sportage r gti',
      year: 2019,
      price: 22900,
      typeBody: 'jeep',
      color: 'plateado',
    });
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente quiere otro color del Sportage.\nPide precio: no\nPide otro color: sí\nTiene duda: no\nEs despedida: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'Sí, hay Sportage 2019 rojo y Sportage 2024 plomo. ¿Cuál le interesa?',
        meta: { vehiculo: null },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'No tienen otro color?',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/OTRO COLOR/i);
    expect(system).toMatch(/rojo/i);
    expect(system).toMatch(/plomo/i);
    expect(system).not.toMatch(/EL HILO SIGUE CON EL VEHÍCULO/i);
    expect(system).not.toMatch(/inventory_id=sportage-1/);
    expect(system).not.toMatch(/\$22900/);
  });

  it('si ya envió la cédula no se la vuelve a pedir', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'eco-1',
      brand: 'ford',
      model: 'ecosport',
      year: 2020,
      price: 16000,
      typeBody: 'jeep',
      color: 'blanco',
      mileage: 128205,
    });
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente ya envió la cédula para financiamiento.\nPide precio: no\nPide crédito: no\nTiene duda: no\nEs despedida: no',
      )
      .mockResolvedValueOnce('{"intenciones":["financiamiento"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'Por favor, páseme su número de cédula para que un asesor pueda revisar si califica para el financiamiento del Ford Ecosport 2020 blanco.',
        meta: { vehiculo: { inventory_id: 'eco-1' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'mi numero de cedula es 1102986013',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(persistence.saveLeadCedula).toHaveBeenCalledWith('1', '1102986013');
    expect(system).toMatch(/YA ENVIÓ LA CÉDULA/i);
    expect(result?.reply.mensaje).toMatch(/Recibí su cédula/i);
    expect(result?.reply.mensaje).toMatch(/asesor revisa si califica/i);
    expect(result?.reply.mensaje).not.toMatch(/páseme su número de cédula/i);
  });

  it('si la cédula ya está guardada no la vuelve a pedir', async () => {
    persistence.loadLeadCedula.mockResolvedValue('1102986013');
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'eco-1',
      brand: 'ford',
      model: 'ecosport',
      year: 2020,
      price: 16000,
    });
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente pregunta por la visita.\nPide precio: no',
      )
      .mockResolvedValueOnce('{"intenciones":["visita"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'Por favor, páseme su número de cédula para el financiamiento.',
        meta: { vehiculo: { inventory_id: 'eco-1' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'puedo ir el sábado?',
    });

    expect(persistence.saveLeadCedula).not.toHaveBeenCalled();
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/YA TENEMOS LA CÉDULA/i);
    expect(result?.reply.mensaje).toMatch(/Recibí su cédula|asesor revisa/i);
    expect(result?.reply.mensaje).not.toMatch(/páseme su número de cédula/i);
  });

  it('yundad se lee como Hyundai del patio y no como un modelo que no existe', async () => {
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'tucson-1',
        brand: 'hyundai',
        model: 'tucson gl',
        year: 2018,
        price: 18900,
        typeBody: 'jeep',
        color: 'blanco',
      },
      {
        id: 'kona-1',
        brand: 'hyundai',
        model: 'kona gl',
        year: 2022,
        price: 21990,
        typeBody: 'jeep',
        color: 'rojo',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente quiere el precio de un Hyundai.\nPide precio: sí',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Tenemos Tucson y Kona Hyundai. ¿Cuál le interesa?',
        meta: { vehiculo: null },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'Buenas tarde que precio el yundad',
    });

    expect(catalog.listByBrand).toHaveBeenCalledWith('hyundai');
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/tucson|kona/i);
    expect(system).not.toMatch(/no hay yundad/i);
    expect(system).not.toMatch(/no tenemos yundad/i);
  });

  it('Peugeot 2008 es el modelo, no un año que no existe', async () => {
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'p2008-2022',
        brand: 'peugeot',
        model: '2008 fin',
        year: 2022,
        price: 18900,
        typeBody: 'jeep',
        color: 'plomo',
        mileage: 95848,
        transmission: 'manual',
      },
      {
        id: 'p3008n',
        brand: 'peugeot',
        model: '3008n',
        year: 2018,
        price: 21900,
        typeBody: 'jeep',
        color: 'negro',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente quiere el Peugeot 2008.\nPide precio: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'Tenemos el Peugeot 2008 FIN 2022 plomo, manual, 95848 km.',
        meta: { vehiculo: { inventory_id: 'p2008-2022' } },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'Hola. Me interesa el Peugeot 2008',
    });

    expect(catalog.listByBrand).toHaveBeenCalledWith('peugeot');
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/2008 FIN 2022|p2008-2022/i);
    expect(system).not.toMatch(/No hay 2008 2008/i);
    expect(system).not.toMatch(/No hay 3008n 2008/i);
    expect(system).not.toMatch(/no tenemos Peugeot 3008n 2008/i);
  });

  it('hyundai y 10: primero no hay i10, no lo vende como Kona ni vuelve al Sportage', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'sportage-1',
      brand: 'kia',
      model: 'sportage r gti',
      year: 2019,
      price: 22900,
      typeBody: 'jeep',
      color: 'plateado',
    });
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content:
          'Tenemos Sportage SL 2019 negro, GTI 2019 rojo y GTI 2019 plateado. ¿Cuál le interesa?',
      },
    ]);
    conversation.loadVehicleBrand.mockResolvedValue('kia');
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'kona-1',
        brand: 'hyundai',
        model: 'kona gls',
        year: 2022,
        price: 21990,
        typeBody: 'jeep',
        color: 'azul',
        mileage: 54694,
      },
    ]);
    catalog.listAvailableExcept.mockResolvedValue([
      {
        id: 'kona-1',
        brand: 'hyundai',
        model: 'kona gls',
        year: 2022,
        price: 21990,
        typeBody: 'jeep',
        color: 'azul',
        mileage: 54694,
      },
      {
        id: 'sportage-1',
        brand: 'kia',
        model: 'sportage r gti',
        year: 2019,
        price: 22900,
        typeBody: 'jeep',
        color: 'plateado',
        mileage: 64000,
      },
      {
        id: 'picanto-1',
        brand: 'kia',
        model: 'picanto lx ac 1.2',
        year: 2023,
        price: 15990,
        typeBody: 'hatchback',
        color: 'blanco',
        mileage: 21000,
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente pregunta si hay Hyundai i10.\nPide precio: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'No tenemos Hyundai i10. Si le interesa, hay un Picanto.',
        meta: { vehiculo: { inventory_id: 'picanto-1' } },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'Tiene el hyundai y 10',
    });

    expect(catalog.listByBrand).toHaveBeenCalledWith('hyundai');
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/No hay i10|no tenemos i10/i);
    expect(system).toMatch(/picanto/i);
    expect(system).toMatch(/inventory_id=picanto-1/);
    expect(system).toMatch(/CAMBIO DE MODELO/i);
    expect(system).not.toMatch(/EL HILO SIGUE CON EL VEHÍCULO/i);
    expect(system).not.toMatch(/inventory_id=sportage-1/);
    expect(system).not.toMatch(/inventory_id=kona-1/);
  });

  it('dispongo de 10000 es presupuesto: lista lo que cabe, no arma cuota', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'xtrail-1',
      brand: 'nissan',
      model: 'x-trail sense cvt',
      year: 2016,
      price: 16890,
      typeBody: 'jeep',
      color: 'azul',
    });
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content:
          'El Nissan X-Trail 2016 tiene un precio de contado de $16890.',
      },
    ]);
    conversation.loadVehicleBrand.mockResolvedValue('nissan');
    catalog.listAvailableExcept.mockResolvedValue([
      {
        id: 'xtrail-1',
        brand: 'nissan',
        model: 'x-trail sense cvt',
        year: 2016,
        price: 16890,
        typeBody: 'jeep',
      },
      {
        id: 'kona-1',
        brand: 'hyundai',
        model: 'kona gls',
        year: 2022,
        price: 21990,
        typeBody: 'jeep',
      },
      {
        id: 'rio-1',
        brand: 'kia',
        model: 'rio lx',
        year: 2018,
        price: 9800,
        typeBody: 'sedan',
      },
      {
        id: 'picanto-1',
        brand: 'kia',
        model: 'picanto lx',
        year: 2017,
        price: 8900,
        typeBody: 'hatchback',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente dispone de 10000 de contado.\nPide precio: no\nPide crédito: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'En ese presupuesto hay un Picanto y un Río.',
        meta: { vehiculo: null },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'Dispongo de 10.000$',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/PRESUPUESTO DE CONTADO: \$10000/);
    expect(system).toMatch(/picanto|rio/i);
    expect(system).not.toMatch(/PIDIÓ CRÉDITO \/ FINANCIAMIENTO/i);
    expect(system).not.toMatch(/EL HILO SIGUE CON EL VEHÍCULO/i);
    expect(system).not.toMatch(/inventory_id=kona-1/);
    expect(system).not.toMatch(/inventory_id=xtrail-1/);
  });

  it('qué vehículo por 10000 lista patio y no dice que no hay SUV si no toca', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'xtrail-1',
      brand: 'nissan',
      model: 'x-trail sense cvt',
      year: 2016,
      price: 16890,
      typeBody: 'jeep',
    });
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content: 'El X-Trail 2016 queda por encima. ¿Ve otras opciones?',
      },
    ]);
    catalog.listAvailableExcept.mockResolvedValue([
      {
        id: 'rio-1',
        brand: 'kia',
        model: 'rio lx',
        year: 2018,
        price: 9800,
        typeBody: 'sedan',
      },
      {
        id: 'kona-1',
        brand: 'hyundai',
        model: 'kona gls',
        year: 2022,
        price: 21990,
        typeBody: 'jeep',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente pregunta qué hay por 10000.\nPide precio: no\nPide crédito: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Hay un Kia Río 2018 en ese presupuesto.',
        meta: { vehiculo: null },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'Qué vehículo tiene por 10.000$',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/PRESUPUESTO DE CONTADO: \$10000/);
    expect(system).toMatch(/rio/i);
    expect(system).not.toMatch(/inventory_id=kona-1/);
    expect(system).toMatch(/Prohibido decir que no hay un tipo/i);
  });

  it('los precios de las que ya listó sí salen, sin placa', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'xtrail-1',
      brand: 'nissan',
      model: 'x-trail sense cvt',
      year: 2016,
      price: 16890,
      typeBody: 'jeep',
    });
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content:
          'Hay un Kia Río 2018 sedán y un Picanto 2017 hatchback en ese presupuesto.',
      },
    ]);
    catalog.listAvailableExcept.mockResolvedValue([
      {
        id: 'rio-1',
        brand: 'kia',
        model: 'rio lx',
        year: 2018,
        price: 9800,
        typeBody: 'sedan',
      },
      {
        id: 'picanto-1',
        brand: 'kia',
        model: 'picanto lx',
        year: 2017,
        price: 8900,
        typeBody: 'hatchback',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente pide los precios de esas unidades.\nPide precio: sí\nPide crédito: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'El Río 2018 está en $9800 y el Picanto 2017 en $8900. La placa del Río es P7.',
        meta: { vehiculo: null },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Los precio por favor',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/\$9800|\$8900/);
    expect(system).toMatch(/PIDIÓ LOS PRECIOS/i);
    expect(result?.reply.mensaje).toMatch(/\$9800/);
    expect(result?.reply.mensaje).toMatch(/\$8900/);
    expect(result?.reply.mensaje).not.toMatch(/placa/i);
  });

  it('2019 de la misma D-max no ofrece un Tracker', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'dmax-2023',
      brand: 'chevrolet',
      model: 'd-max crdi 2.5 cd 4x2 tm diesel',
      year: 2023,
      price: 28990,
      typeBody: 'camioneta',
    });
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content:
          'El Chevrolet D-max CRDI 2023 plateado está en $28990. Es un carro cuidado y en buen estado.',
      },
    ]);
    conversation.loadVehicleBrand.mockResolvedValue('chevrolet');
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'dmax-2023',
        brand: 'chevrolet',
        model: 'd-max crdi 2.5 cd 4x2 tm diesel',
        year: 2023,
        price: 28990,
        typeBody: 'camioneta',
        color: 'plateado',
        mileage: 77613,
      },
      {
        id: 'dmax-2020',
        brand: 'chevrolet',
        model: 'd-max crdi 2.5 cd 4x2 tm diesel',
        year: 2020,
        price: 21900,
        typeBody: 'camioneta',
        color: 'blanco',
        mileage: 93787,
      },
      {
        id: 'tracker-1',
        brand: 'chevrolet',
        model: 'tracker ls',
        year: 2022,
        price: 18900,
        typeBody: 'jeep',
        color: 'blanco',
        mileage: 18277,
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente pregunta si hay D-max 2019.\nPide precio: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'No hay D-max 2019. Hay una 2020.',
        meta: { vehiculo: { inventory_id: 'dmax-2020' } },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'tendrá del 2019 de la misma',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/No hay Dmax 2019|no tenemos Dmax 2019/i);
    expect(system).toMatch(/dmax-2020|d-max crdi/i);
    expect(system).toMatch(/PROHIBIDO otra línea/i);
    expect(system).not.toMatch(/tracker/i);
  });

  it('si ya dijo lo del mecánico no lo vuelve a mandar', async () => {
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'dmax-2023',
      brand: 'chevrolet',
      model: 'd-max crdi 2.5 cd 4x2 tm diesel',
      year: 2023,
      price: 28990,
      typeBody: 'camioneta',
      mileage: 77613,
    });
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content:
          'El D-max 2023 está en $28990. Es un carro cuidado y en buen estado, con 77613 km reales. Puede traer a su mecánico para que lo revise.',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente pide el valor.\nPide precio: sí',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'El precio es $28990. Es un carro cuidado y en buen estado. Puede traer a su mecánico para que lo revise. El precio registrado es $28990.',
        meta: { vehiculo: { inventory_id: 'dmax-2023' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Si iel valor',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/PROHIBIDO repetirlo/i);
    expect(result?.reply.mensaje).toMatch(/\$28990/);
    expect(result?.reply.mensaje).not.toMatch(/mecánico/i);
    expect(result?.reply.mensaje).not.toMatch(/carro cuidado/i);
  });

  it('si ya dio la ficha el precio se justifica y no se vuelve a listar', async () => {
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'user',
        content: 'Hola. Me interesa el Foton Tunland 2023',
      },
      {
        role: 'assistant',
        content: 'Buen dia te saluda Felipe Cabrera, seré su asesor.',
      },
      {
        role: 'user',
        content: 'Precio 4x4 diésel',
      },
      {
        role: 'user',
        content: 'Dé contado',
      },
      {
        role: 'assistant',
        content:
          'Estimado, tenemos disponible un Foton Tunland TM 2023 color plateado, con 113692 km, transmisión manual y tracción 4x4. Aquí tiene también las fotos del vehículo.',
      },
      {
        role: 'assistant',
        content:
          'Le envié fotos de la Foton Tunland 2023, ¿le gustó o hay algo que le detiene?',
      },
    ]);
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'tunland-1',
      brand: 'foton',
      model: 'tunland tm',
      year: 2023,
      price: 21800,
      typeBody: 'camioneta',
      color: 'plateado',
      mileage: 113692,
      transmission: 'manual',
    });
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente pide el precio de la unidad que ya vio.\nPide precio: sí\nPide crédito: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'El precio es $21800. Es un carro cuidado, con garantía en documentos y traspaso.',
        meta: { vehiculo: { inventory_id: 'tunland-1', precio: 21800 } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Que precio tiene',
    });

    expect(openai.complete).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.stringMatching(/Ficha ya presentada: sí[\s\S]*Pide el precio: sí/i),
    );
    expect(catalog.fetchAgentPrompts).toHaveBeenCalledWith(
      expect.arrayContaining(['rol', 'manejocaro']),
    );
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/YA SE DIO LA FICHA/i);
    expect(system).toContain('$21800');
    expect(system).toMatch(/justifica el valor/i);
    expect(system).toMatch(/ficha YA se presentó/i);
    expect(system).not.toMatch(/color=plateado/i);
    expect(system).not.toMatch(/caja=manual/i);
    expect(system).not.toMatch(/AL CLIENTE:.*mecánico/i);
    expect(result?.reply.mensaje).toMatch(/21800/);
    expect(result?.reply.mensaje).not.toMatch(/tenemos disponible/i);
  });

  it('objeción de precio no vuelve a mandar la ficha y carga agent_prompts', async () => {
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content:
          'Johnny, ¿qué le pareció el Kia Picanto LX 2023? El precio es $15990.',
      },
    ]);
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'picanto-1',
      brand: 'kia',
      model: 'picanto lx ac 1.2',
      year: 2023,
      price: 15990,
      typeBody: 'hatchback',
      color: 'blanco',
      mileage: 64127,
      transmission: 'automática',
    });
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente dice que el precio es alto.\nPide precio: sí\nPide crédito: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'El valor se sostiene por el estado y los 64127 km, con garantía en documentos y traspaso. ¿Le interesa verlo en el patio?',
        meta: { vehiculo: { inventory_id: 'picanto-1' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'El precio muy alto',
    });

    expect(openai.complete).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.stringMatching(/Objeta el valor: sí/i),
    );
    expect(catalog.fetchAgentPrompts).toHaveBeenCalledWith(
      expect.arrayContaining(['rol', 'objeciones', 'manejocaro']),
    );
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/OBJECIÓN/i);
    expect(system).toMatch(/No vuelvas a mandar la ficha/i);
    expect(system).toMatch(/garantía en documentos/i);
    expect(system).not.toMatch(/AL CLIENTE:.*mecánico/i);
    expect(result?.reply.mensaje).not.toMatch(/tenemos disponible/i);
  });

  it('La 2022 elige la de la lista y no dice que no hay', async () => {
    conversation.loadVehicleBrand.mockResolvedValue('chevrolet');
    conversation.recentMessages.mockResolvedValue([
      { role: 'user', content: 'Tienen D-max 4x4?' },
      {
        role: 'assistant',
        content:
          'Estimado, tenemos disponible un Chevrolet D-Max 4x4 manual 2022 color vino con 87687 km, y una Chevrolet Luv D-Max 4x4 manual 2006 color blanco con el kilometraje todavía no cargado.',
      },
      { role: 'user', content: 'ok' },
      {
        role: 'assistant',
        content: '¿Le interesa financiamiento o prefiere venir a verla?',
      },
    ]);
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'dmax-2022',
        brand: 'chevrolet',
        model: 'd-max crdi 2.5 cd 4x4 tm diesel',
        year: 2022,
        price: 26900,
        typeBody: 'camioneta',
        color: 'vino',
        mileage: 87687,
      },
      {
        id: 'dmax-2023',
        brand: 'chevrolet',
        model: 'd-max crdi 2.5 cd 4x2 tm diesel',
        year: 2023,
        price: 28900,
        typeBody: 'camioneta',
        color: 'plateado',
        mileage: 77613,
      },
      {
        id: 'luv-2006',
        brand: 'chevrolet',
        model: 'luv d-max 4x4 tm',
        year: 2006,
        price: 8900,
        typeBody: 'camioneta',
        color: 'blanco',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente elige la D-Max 2022 de las que le mostraron.\nPide precio: no\nPide crédito: no',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'Estimado, la Chevrolet D-Max CRDi 2.5 CD 4x4 2022 color vino tiene 87687 km. Aquí tiene las fotos.',
        meta: { vehiculo: { inventory_id: 'dmax-2022' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'y la 2022',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toContain('inventory_id=dmax-2022');
    expect(system).toMatch(/ELIGIÓ esta unidad/i);
    expect(system).toMatch(/Ya hay ficha|no busques de nuevo/i);
    expect(system).not.toMatch(/PRIMERO dilo claro: no tenemos/i);
    expect(system).not.toMatch(/No hay Dmax 2022/i);
    expect(system).not.toMatch(/dmax-2023|luv-2006/);
    expect(system).toMatch(/PROHIBIDO pedir entrada/i);
    expect(result?.reply.mensaje).not.toMatch(/no tenemos/i);
  });

  it('si ya dijo D-max CRDI 2023 no lista otras ni una Luv', async () => {
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'dmax-2020',
        brand: 'chevrolet',
        model: 'd-max crdi 2.5 cd 4x2 tm diesel',
        year: 2020,
        price: 21900,
        typeBody: 'camioneta',
        color: 'blanco',
        mileage: 93787,
      },
      {
        id: 'dmax-2023',
        brand: 'chevrolet',
        model: 'd-max crdi 2.5 cd 4x2 tm diesel',
        year: 2023,
        price: 28900,
        typeBody: 'camioneta',
        color: 'plateado',
        mileage: 77613,
      },
      {
        id: 'dmax-2022',
        brand: 'chevrolet',
        model: 'd-max crdi 2.5 cd 4x4 tm diesel',
        year: 2022,
        price: 26900,
        typeBody: 'camioneta',
        color: 'vino',
        mileage: 87687,
      },
      {
        id: 'luv-2006',
        brand: 'chevrolet',
        model: 'luv max 4x4 tm',
        year: 2006,
        price: 8900,
        typeBody: 'camioneta',
        color: 'blanco',
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente quiere el precio de la D-max 2023.\nPide precio: sí',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'Tenemos la D-max CRDI 2023 plateado. Aquí las fotos.',
        meta: { vehiculo: { inventory_id: 'dmax-2023' } },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText:
        'Hola. Me interesa el Chevrolet D-max CRDI 2023q\nQ precio esta la Dimax',
    });

    expect(catalog.listByBrand).toHaveBeenCalledWith('chevrolet');
    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toContain('inventory_id=dmax-2023');
    expect(system).toMatch(/una sola unidad/i);
    expect(system).not.toMatch(/Nómbralas todas/i);
    expect(system).not.toMatch(/dmax-2020|dmax-2022|luv-2006/i);
  });

  it('cuota con entrada y plazo no deja huecos de precio', async () => {
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'user',
        content: 'Me interesa la Dmax 2020',
      },
      {
        role: 'assistant',
        content:
          'La Chevrolet Dmax 2020 está disponible. Para crédito, ¿con cuánto de entrada y a cuántos años desea financiar?',
      },
      { role: 'user', content: '2 mil de entrada' },
    ]);
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'dmax-2020',
      brand: 'chevrolet',
      model: 'dmax',
      year: 2020,
      price: 22900,
      typeBody: 'camioneta',
    });
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente da 2000 de entrada a 6 años.\nPide precio: no\nPide crédito: sí',
      )
      .mockResolvedValueOnce('{"intenciones":["financiamiento"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'El precio de contado es de $22900. Con una entrada de $2000 y un plazo de 6 años, la cuota estimada mensual sería alrededor de $590.21. ¿Me pasa su cédula?',
        meta: {
          precio_mostrado: true,
          cuota_mostrada: true,
          vehiculo: { inventory_id: 'dmax-2020', precio: 22900 },
        },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Para 6 años',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/\$22900/);
    expect(system).toMatch(/PIDIÓ CRÉDITO/i);
    expect(result?.reply.mensaje).toMatch(/22900/);
    expect(result?.reply.mensaje).toMatch(/2000/);
    expect(result?.reply.mensaje).toMatch(/590/);
    expect(result?.reply.mensaje).not.toMatch(/es de\s*\./);
    expect(result?.reply.mensaje).not.toMatch(/entrada de y/i);
  });

  it('proforma a 5 años no borra precio ni entrada', async () => {
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content:
          'El precio del Chevrolet d-max es $32,990, justificado por su buen estado y km real. Con $1,000 de entrada, el financiamiento sería vía banco o cooperativa; ¿a cuántos años desea financiar?',
      },
    ]);
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'dmax-2022',
      brand: 'chevrolet',
      model: 'd-max crdi 2.5 cd 4x4 tm',
      year: 2022,
      price: 32990,
      typeBody: 'camioneta',
      color: 'vino',
      mileage: 87687,
    });
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente quiere la cuota a 5 años.\nPide precio: no\nPide crédito: sí\nObjeción de precio: sí',
      )
      .mockResolvedValueOnce('{"intenciones":["financiamiento"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'El Chevrolet d-max crdi 2.5 cd 4x4 2022 color vino, con 87687 km y transmisión manual, tiene un precio de $32,990. Con $1,000 de entrada para financiar a 5 años la cuota aproximada sería de $962.39 mensuales. Este valor es referencial y depende del banco o cooperativa elegida.',
        meta: {
          precio_mostrado: true,
          cuota_mostrada: true,
          vehiculo: { inventory_id: 'dmax-2022', precio: 32990 },
        },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText:
        'Para 5 años Melo haces proforma aver cuánto me cay de mensual',
    });

    expect(result?.reply.mensaje).toMatch(/32,990/);
    expect(result?.reply.mensaje).toMatch(/1,000/);
    expect(result?.reply.mensaje).toMatch(/962\.39/);
    expect(result?.reply.mensaje).not.toMatch(/tiene un\s*\./i);
    expect(result?.reply.mensaje).not.toMatch(/con de entrada/i);
  });

  it('aaa o más entrada no pide repetir la cuota ya dicha', async () => {
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'assistant',
        content:
          'Para financiar el Chevrolet d-max la cuota mensual aproximada es de $962.39.',
      },
    ]);
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'dmax-2022',
      brand: 'chevrolet',
      model: 'd-max crdi 2.5 cd 4x4 tm',
      year: 2022,
      price: 32990,
      typeBody: 'camioneta',
    });
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente ya entendió la cuota.\nPide precio: no\nPide crédito: no',
      )
      .mockResolvedValueOnce('{"intenciones":["financiamiento"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente: 'Cuando tenga la entrada, la recalculamos.',
        meta: { vehiculo: { inventory_id: 'dmax-2022' } },
      }),
    );

    await service.handleTurn({
      contactId: '1',
      customerText: 'Aaa bueno voy buscar un poco de entrada mas',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/YA SE DIJO LA CUOTA/i);
    expect(system).not.toMatch(/Di el precio de contado de inventario/i);
  });

  it('primera presentación del Vitara no dice el precio', async () => {
    conversation.recentMessages.mockResolvedValue([
      {
        role: 'user',
        content: 'Hola. Me interesa el Suzuki Grand Vitara 2015',
      },
    ]);
    conversation.loadVehicleBrand.mockResolvedValue('suzuki');
    persistence.latestInterestedCar.mockResolvedValue({
      inventoryId: 'vitara-2015',
      brand: 'suzuki',
      model: 'grand vitara sz',
      year: 2015,
      price: 13800,
      typeBody: 'jeep',
      color: 'blanco',
      mileage: 207051,
    });
    catalog.listByBrand.mockResolvedValue([
      {
        id: 'vitara-2015',
        brand: 'suzuki',
        model: 'grand vitara sz',
        year: 2015,
        price: 13800,
        typeBody: 'jeep',
        color: 'blanco',
        mileage: 207051,
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente quiere el Grand Vitara 2015 y solicita fotos.\nPide precio: sí',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'Estimado, tenemos disponible un Suzuki Grand Vitara 2015 color blanco, con 207051 km, transmisión 4x2 y precio de $13800. Aquí tiene también las fotos del vehículo.',
        meta: { vehiculo: { inventory_id: 'vitara-2015', precio: 13800 } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Sí, por favor',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/PRIMERA PRESENTACIÓN/i);
    expect(system).not.toMatch(/\$13800/);
    expect(result?.reply.mensaje).not.toMatch(/13800/);
    expect(result?.reply.mensaje).not.toMatch(/\$/);
    expect(result?.reply.mensaje).toMatch(/Grand Vitara 2015/i);
  });

  it('si el primer mensaje pide el precio, la ficha lo trae', async () => {
    persistence.latestInterestedCar.mockResolvedValue(null);
    catalog.listAvailableExcept.mockResolvedValue([
      {
        id: 'vitara-2015',
        brand: 'suzuki',
        model: 'grand vitara sz',
        year: 2015,
        price: 13800,
        typeBody: 'jeep',
        color: 'blanco',
        mileage: 207051,
      },
    ]);
    openai.complete
      .mockResolvedValueOnce(
        'SOLICITUD ACTUAL:\nCliente quiere el precio del Grand Vitara.\nPide precio: sí',
      )
      .mockResolvedValueOnce('{"intenciones":["compra"]}');
    openai.runSalesAgent.mockResolvedValue(
      JSON.stringify({
        respuesta_cliente:
          'Estimado, tenemos disponible un Grand Vitara 2015 color blanco, con 207051 km, y',
        meta: { vehiculo: { inventory_id: 'vitara-2015' } },
      }),
    );

    const result = await service.handleTurn({
      contactId: '1',
      customerText: 'Precio del grand vitara xfabor',
    });

    const system = openai.runSalesAgent.mock.calls[0][0].system as string;
    expect(system).toMatch(/YA PIDIÓ EL PRECIO/i);
    expect(system).toMatch(/13800/);
    expect(system).not.toMatch(/PROHIBIDO decir el precio, aunque el resumen/i);
    expect(result?.reply.mensaje).toMatch(/13,800/);
    expect(result?.reply.mensaje).toMatch(/Grand Vitara/i);
    expect(result?.reply.mensaje).not.toMatch(/km, y/);
    expect(result?.reply.meta.precioMostrado).toBe(true);
  });
});
