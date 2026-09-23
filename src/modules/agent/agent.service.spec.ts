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
    expect(system).toMatch(/PIDIÓ EL PRECIO/i);
    expect(system).toMatch(/Prohibido placa, cuota, cédula/i);
  });

  it('Q vale pide el precio de esa unidad y no repite la placa', async () => {
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
    expect(system).toMatch(/PIDIÓ EL PRECIO/i);
  });

  it('Valor del Seltos pide el precio y no cédula ni placa', async () => {
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
    expect(system).toMatch(/PIDIÓ EL PRECIO/i);
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
});
