import { CrmService } from './crm.service';
import { KommoClient } from './kommo.client';

describe('CrmService', () => {
  const kommo = { getContact: jest.fn(), getLead: jest.fn() };
  const service = new CrmService(kommo as unknown as KommoClient);

  beforeEach(() => {
    kommo.getContact.mockReset();
    kommo.getLead.mockReset();
  });

  it('pide el contacto y parsea el teléfono', async () => {
    kommo.getContact.mockResolvedValue({
      custom_fields_values: [
        {
          field_code: 'PHONE',
          values: [{ value: '+593983335555' }],
        },
      ],
    });

    await expect(service.getContactPhone('57444397')).resolves.toBe(
      '+593983335555',
    );
    expect(kommo.getContact).toHaveBeenCalledWith('57444397');
  });

  it('apaga el bot si el lead tiene atiende IA? en true', async () => {
    kommo.getLead.mockResolvedValue({
      custom_fields_values: [
        { field_id: 2991942, values: [{ value: true }] },
      ],
    });

    await expect(service.isLeadBotStopped('41423821')).resolves.toBe(true);
    expect(kommo.getLead).toHaveBeenCalledWith('41423821');
  });

  it('devuelve null si no hay contactId', async () => {
    await expect(service.getContactPhone('')).resolves.toBeNull();
    expect(kommo.getContact).not.toHaveBeenCalled();
  });
});
