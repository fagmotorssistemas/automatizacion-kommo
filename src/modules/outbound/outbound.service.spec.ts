import { KOMMO_SALESBOT } from '../crm/kommo.constants';
import { OutboundService } from './outbound.service';

describe('OutboundService', () => {
  const crm = { setRespuestaIa: jest.fn(), runSalesbot: jest.fn() };
  const catalog = { resolvePhotoBots: jest.fn() };
  const service = new OutboundService(crm as never, catalog as never, {
    shadowMode: false,
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
    await service.dispatch('41807269', {
      mensaje: 'Tenemos una EcoSport',
      meta: { vehiculo: { inventory_id: 'inv-1' } },
      img_prefix: 'ford_ecosport_2020',
    });

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
      inventoryId: 'inv-1',
      imgPrefix: 'ford_ecosport_2020',
    });
  });

  it('en sombra no llama a Kommo y deja ver el texto', async () => {
    const shadow = new OutboundService(crm as never, catalog as never, {
      shadowMode: true,
    });

    const result = await shadow.dispatch('41807269', {
      mensaje: 'Tenemos una EcoSport',
      meta: { vehiculo: { inventory_id: 'inv-1' } },
      img_prefix: 'ford_ecosport_2020',
    });

    expect(result).toEqual({
      delivered: false,
      shadow: true,
      photoBots: [166291],
    });
    expect(crm.setRespuestaIa).not.toHaveBeenCalled();
    expect(crm.runSalesbot).not.toHaveBeenCalled();
  });
});
