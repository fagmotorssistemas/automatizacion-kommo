import { CatalogService } from '../catalog/catalog.service';
import { CrmService } from '../crm/crm.service';
import { OutboundService } from '../outbound/outbound.service';
import { FAG_MOTORS_ASSIGNEE } from './vacante.constants';
import { VacanteRepository } from './vacante.repository';
import { VacanteService } from './vacante.service';

describe('VacanteService', () => {
  const repository = {
    findByLeadId: jest.fn(),
    insert: jest.fn(),
  };
  const crm = {
    getContactPhone: jest.fn(),
    listUsers: jest.fn(),
    markVacanteLead: jest.fn(),
  };
  const catalog = { fetchAgentPrompts: jest.fn() };
  const outbound = { isShadowMode: jest.fn(), sendText: jest.fn() };
  const service = new VacanteService(
    repository as unknown as VacanteRepository,
    crm as unknown as CrmService,
    catalog as unknown as CatalogService,
    outbound as unknown as OutboundService,
  );

  const opening = {
    leadId: '41807269',
    contactId: '59458509',
    text: 'Hola. Me interesa el puesto de asesor comercial.',
    inbound: true,
  };

  beforeEach(() => {
    repository.findByLeadId.mockReset();
    repository.insert.mockReset();
    crm.getContactPhone.mockReset();
    crm.listUsers.mockReset();
    crm.markVacanteLead.mockReset();
    catalog.fetchAgentPrompts.mockReset();
    outbound.isShadowMode.mockReset();
    outbound.sendText.mockReset();
    repository.findByLeadId.mockResolvedValue('missing');
    repository.insert.mockResolvedValue('created');
    crm.getContactPhone.mockResolvedValue('+593999000111');
    crm.listUsers.mockResolvedValue([{ id: 42, name: 'FAG Motors' }]);
    crm.markVacanteLead.mockResolvedValue(true);
    catalog.fetchAgentPrompts.mockResolvedValue([
      { name: 'vacante', content: 'Gracias, revisaremos su postulación.' },
    ]);
    outbound.isShadowMode.mockReturnValue(false);
    outbound.sendText.mockResolvedValue({ wrote: true, botRan: true });
  });

  it('un mensaje de venta sigue de largo', async () => {
    await expect(
      service.intercept({
        ...opening,
        text: 'Hola. Me interesa el Suzuki Grand Vitara 2015',
      }),
    ).resolves.toBe('pass');
    expect(repository.insert).not.toHaveBeenCalled();
    expect(outbound.sendText).not.toHaveBeenCalled();
  });

  it('el primer anuncio entra a ofertas, responde una vez y cambia el asesor', async () => {
    await expect(service.intercept(opening)).resolves.toBe('opened');
    expect(repository.insert).toHaveBeenCalledWith({
      leadIdKommo: '41807269',
      phone: '+593999000111',
      etiqueta: 'vacante_asesor_comercial',
      assignedTo: FAG_MOTORS_ASSIGNEE,
    });
    expect(outbound.sendText).toHaveBeenCalledWith(
      '41807269',
      'Gracias, revisaremos su postulación.',
    );
    expect(crm.markVacanteLead).toHaveBeenCalledWith(
      '41807269',
      'vacante_asesor_comercial',
      42,
    );
  });

  it('si ya está en ofertas no responde ni sigue', async () => {
    repository.findByLeadId.mockResolvedValue('found');

    await expect(
      service.intercept({ ...opening, text: 'les mando la hoja de vida' }),
    ).resolves.toBe('silent');
    expect(repository.insert).not.toHaveBeenCalled();
    expect(outbound.sendText).not.toHaveBeenCalled();
    expect(crm.markVacanteLead).not.toHaveBeenCalled();
  });

  it('en shadow no manda WhatsApp', async () => {
    outbound.isShadowMode.mockReturnValue(true);

    await expect(service.intercept(opening)).resolves.toBe('opened');
    expect(outbound.sendText).not.toHaveBeenCalled();
    expect(crm.markVacanteLead).toHaveBeenCalled();
  });

  it('si la tabla no responde no lo manda a ventas', async () => {
    repository.findByLeadId.mockResolvedValue('unavailable');

    await expect(service.intercept(opening)).resolves.toBe('held');
    expect(repository.insert).not.toHaveBeenCalled();
    expect(outbound.sendText).not.toHaveBeenCalled();
  });

  it('sin fila vacante no inventa un texto y aun así registra', async () => {
    catalog.fetchAgentPrompts.mockResolvedValue([]);

    await expect(service.intercept(opening)).resolves.toBe('opened');
    expect(outbound.sendText).not.toHaveBeenCalled();
    expect(repository.insert).toHaveBeenCalled();
  });
});
