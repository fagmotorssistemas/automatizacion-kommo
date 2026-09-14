import { KommoClient } from './kommo.client';

describe('KommoClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('no llama a Kommo si falta el token', async () => {
    const client = new KommoClient({
      baseUrl: 'https://marketingfagmotorsurfacom.kommo.com',
      token: '',
    });

    await expect(client.getContact('1')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hace GET /contacts/{id} con Bearer del .env', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1 }),
    });

    const client = new KommoClient({
      baseUrl: 'https://marketingfagmotorsurfacom.kommo.com',
      token: 'token-de-prueba',
    });

    await expect(client.getContact('57444397')).resolves.toEqual({ id: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://marketingfagmotorsurfacom.kommo.com/api/v4/contacts/57444397',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          authorization: 'Bearer token-de-prueba',
        }),
      }),
    );
  });
});
