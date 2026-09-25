import { KOMMO_SALESBOT } from '../crm/kommo.constants';
import { PHOTO_AFTER_TEXT_MS } from './outbound.constants';
import { OutboundService } from './outbound.service';

const UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

describe('OutboundService', () => {
  const crm = { setRespuestaIa: jest.fn(), runSalesbot: jest.fn() };
  const catalog = { resolvePhotoBots: jest.fn() };
  const service = new OutboundService(crm as never, catalog as never, {
    shadowMode: false,
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    crm.setRespuestaIa.mockReset();
    crm.runSalesbot.mockReset();
    catalog.resolvePhotoBots.mockReset();
    crm.setRespuestaIa.mockResolvedValue(true);
    crm.runSalesbot.mockResolvedValue(true);
    catalog.resolvePhotoBots.mockResolvedValue([166291]);
  });

  it('manda un salesbot de texto y uno de fotos', async () => {
    const result = await service.dispatch(
      '41807269',
      {
        mensaje: 'Tenemos una EcoSport',
        meta: {
          precioMostrado: false,
          cuotaMostrada: false,
          vehiculo: { inventory_id: UUID },
        },
        img_prefix: '',
      },
      { photoAfterTextMs: 0 },
    );

    expect(crm.setRespuestaIa).toHaveBeenCalledWith(
      '41807269',
      'Tenemos una EcoSport',
    );
    expect(crm.runSalesbot).toHaveBeenNthCalledWith(
      1,
      KOMMO_SALESBOT.TEXTO,
      '41807269',
    );
    expect(crm.runSalesbot).toHaveBeenNthCalledWith(2, 166291, '41807269');
    expect(catalog.resolvePhotoBots).toHaveBeenCalledWith({
      inventoryId: UUID,
    });
    expect(result.missingPhotos).toBe(false);
  });

  it('si hay UUID pero no bot_id, avisa al cliente y no dispara fotos', async () => {
    catalog.resolvePhotoBots.mockResolvedValue([]);

    const result = await service.dispatch('41807269', {
      mensaje: 'Tenemos la unidad.',
      meta: {
        precioMostrado: false,
        cuotaMostrada: false,
        vehiculo: { inventory_id: UUID },
      },
      img_prefix: '',
    });

    expect(result.missingPhotos).toBe(true);
    expect(result.photoBots).toEqual([]);
    expect(crm.setRespuestaIa).toHaveBeenCalledWith(
      '41807269',
      expect.stringContaining('no tengo fotos'),
    );
    expect(crm.runSalesbot).toHaveBeenCalledTimes(1);
    expect(crm.runSalesbot).toHaveBeenCalledWith(
      KOMMO_SALESBOT.TEXTO,
      '41807269',
    );
  });

  it('en sombra no llama a Kommo y deja ver el texto', async () => {
    const shadow = new OutboundService(crm as never, catalog as never, {
      shadowMode: true,
    });

    const result = await shadow.dispatch('41807269', {
      mensaje: 'Tenemos una EcoSport',
      meta: {
        precioMostrado: false,
        cuotaMostrada: false,
        vehiculo: { inventory_id: UUID },
      },
      img_prefix: '',
    });

    expect(result).toEqual({
      delivered: false,
      shadow: true,
      photoBots: [166291],
      missingPhotos: false,
    });
    expect(crm.setRespuestaIa).not.toHaveBeenCalled();
    expect(crm.runSalesbot).not.toHaveBeenCalled();
  });

  it('en sombra no dispara el salesbot de alta contacto', async () => {
    const shadow = new OutboundService(crm as never, catalog as never, {
      shadowMode: true,
    });

    await expect(shadow.announceNewContact('41807269')).resolves.toEqual({
      ran: false,
      shadow: true,
    });
    expect(crm.runSalesbot).not.toHaveBeenCalled();
  });

  it('no reenvía fotos si ese carro ya se mostró', async () => {
    const result = await service.dispatch(
      '41807269',
      {
        mensaje: 'El Seltos está en $19990.',
        meta: {
          precioMostrado: true,
          cuotaMostrada: false,
          vehiculo: { inventory_id: UUID },
        },
        img_prefix: '',
      },
      { alreadyShown: true },
    );

    expect(result.photoBots).toEqual([]);
    expect(result.missingPhotos).toBe(false);
    expect(catalog.resolvePhotoBots).not.toHaveBeenCalled();
    expect(crm.runSalesbot).toHaveBeenCalledTimes(1);
    expect(crm.runSalesbot).toHaveBeenCalledWith(
      KOMMO_SALESBOT.TEXTO,
      '41807269',
    );
    expect(crm.setRespuestaIa).toHaveBeenCalledWith(
      '41807269',
      'El Seltos está en $19990.',
    );
  });

  it('si no dispara fotos, no deja el “aquí tiene las fotos”', async () => {
    await service.dispatch(
      '41807269',
      {
        mensaje:
          'Estimado, tenemos disponible un Chevrolet Dmax 2022 color vino, con 87687 km. Aquí tiene también las fotos del vehículo para que pueda verlo mejor.',
        meta: {
          precioMostrado: false,
          cuotaMostrada: false,
          vehiculo: { inventory_id: UUID },
        },
        img_prefix: '',
      },
      { alreadyShown: true, wantsPhotos: false },
    );

    expect(crm.setRespuestaIa).toHaveBeenCalledWith(
      '41807269',
      'Estimado, tenemos disponible un Chevrolet Dmax 2022 color vino, con 87687 km.',
    );
    expect(catalog.resolvePhotoBots).not.toHaveBeenCalled();
  });

  it('solicita fotos sin inventory_id no dispara salesbots de fotos', async () => {
    await service.dispatch(
      '41807269',
      {
        mensaje: '¿Qué carro le interesa?',
        meta: {
          precioMostrado: false,
          cuotaMostrada: false,
          vehiculo: null,
        },
        img_prefix: '',
      },
      { alreadyShown: false, wantsPhotos: true },
    );

    expect(catalog.resolvePhotoBots).not.toHaveBeenCalled();
    expect(crm.runSalesbot).toHaveBeenCalledTimes(1);
    expect(crm.runSalesbot).toHaveBeenCalledWith(
      KOMMO_SALESBOT.TEXTO,
      '41807269',
    );
  });

  it('cola de varias unidades: enunciado corto, fotos y espera entre cada una', async () => {
    catalog.resolvePhotoBots
      .mockResolvedValueOnce([101])
      .mockResolvedValueOnce([202]);

    const result = await service.dispatch(
      '41807269',
      {
        mensaje: 'Le mando las fotos de cada una, una por una.',
        meta: {
          precioMostrado: false,
          cuotaMostrada: false,
          vehiculo: null,
        },
        img_prefix: '',
      },
      {
        wantsPhotos: true,
        packGapMs: 0,
        photoAfterTextMs: 0,
        photoQueue: [
          { inventoryId: UUID, label: 'Sportage 2024 plomo' },
          {
            inventoryId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
            label: 'Sportage 2019 rojo',
          },
        ],
      },
    );

    expect(crm.setRespuestaIa).toHaveBeenNthCalledWith(
      1,
      '41807269',
      'Sportage 2024 plomo',
    );
    expect(crm.setRespuestaIa).toHaveBeenNthCalledWith(
      2,
      '41807269',
      'Sportage 2019 rojo',
    );
    expect(crm.runSalesbot).toHaveBeenCalledWith(101, '41807269');
    expect(crm.runSalesbot).toHaveBeenCalledWith(202, '41807269');
    expect(result.photoBots).toEqual([101, 202]);
    expect(crm.setRespuestaIa).not.toHaveBeenCalledWith(
      '41807269',
      expect.stringContaining('una por una'),
    );
  });

  it('si pide fotos otra vez, sí las manda aunque ya las haya visto', async () => {
    await service.dispatch(
      '41807269',
      {
        mensaje: 'Aquí de nuevo las fotos.',
        meta: {
          precioMostrado: false,
          cuotaMostrada: false,
          vehiculo: { inventory_id: UUID },
        },
        img_prefix: '',
      },
      { alreadyShown: true, wantsPhotos: true, photoAfterTextMs: 0 },
    );

    expect(catalog.resolvePhotoBots).toHaveBeenCalledWith({
      inventoryId: UUID,
    });
    expect(crm.runSalesbot).toHaveBeenNthCalledWith(2, 166291, '41807269');
  });

  it('las fotos salen 5s después del mensaje', async () => {
    jest.useFakeTimers();
    const times: number[] = [];
    crm.runSalesbot.mockImplementation(async () => {
      times.push(Date.now());
      return true;
    });

    const pending = service.dispatch('41807269', {
      mensaje: 'Tenemos una EcoSport',
      meta: {
        precioMostrado: false,
        cuotaMostrada: false,
        vehiculo: { inventory_id: UUID },
      },
      img_prefix: '',
    });
    await jest.advanceTimersByTimeAsync(PHOTO_AFTER_TEXT_MS - 1);
    expect(times).toHaveLength(1);
    expect(crm.runSalesbot).toHaveBeenNthCalledWith(
      1,
      KOMMO_SALESBOT.TEXTO,
      '41807269',
    );
    await jest.advanceTimersByTimeAsync(1);
    await pending;

    expect(times).toHaveLength(2);
    expect(times[1] - times[0]).toBe(PHOTO_AFTER_TEXT_MS);
    expect(crm.runSalesbot).toHaveBeenNthCalledWith(2, 166291, '41807269');
    jest.useRealTimers();
  });

  it('en vivo dispara el salesbot 187553', async () => {
    await expect(service.announceNewContact('41807269')).resolves.toEqual({
      ran: true,
      shadow: false,
    });
    expect(crm.runSalesbot).toHaveBeenCalledWith(
      KOMMO_SALESBOT.ALTA_CONTACTO,
      '41807269',
    );
  });
});
