import { CatalogService } from './catalog.service';

describe('CatalogService.searchByQuery', () => {
  const supabase = {
    matchInventory: jest.fn(),
  };
  const service = new CatalogService(supabase as never);

  beforeEach(() => {
    supabase.matchInventory.mockReset();
  });

  it('si nombra Hilux no busca con el SUV viejo', async () => {
    supabase.matchInventory.mockResolvedValue([
      {
        id: 'h1',
        content: 'toyota hilux cd 2.4 tm',
        metadata: { model: 'hilux cd 2.4 tm', brand: 'toyota' },
      },
    ]);

    const raw = await service.searchByQuery({
      embedding: [0.1],
      query: 'Hilux Manuel',
      tipo: 'suv',
      marca: 'volkswagen',
    });

    expect(JSON.parse(raw)[0].id).toBe('h1');
    expect(supabase.matchInventory).toHaveBeenCalledTimes(1);
    expect(supabase.matchInventory).toHaveBeenCalledWith([0.1], 8, {
      marca: 'toyota',
    });
  });

  it('si con la marca no aparece el modelo reintenta sin marca', async () => {
    supabase.matchInventory
      .mockResolvedValueOnce([
        { id: 'p1', content: 'toyota prado tx', metadata: { model: 'prado tx' } },
      ])
      .mockResolvedValueOnce([
        {
          id: 'h1',
          content: 'toyota hilux cd 2.4 tm',
          metadata: { model: 'hilux cd 2.4 tm' },
        },
      ]);

    const raw = await service.searchByQuery({
      embedding: [0.2],
      query: 'Hilux',
      tipo: 'suv',
      marca: 'toyota',
    });

    expect(JSON.parse(raw)[0].id).toBe('h1');
    expect(supabase.matchInventory).toHaveBeenCalledTimes(2);
    expect(supabase.matchInventory).toHaveBeenLastCalledWith([0.2], 8, {});
  });
});
