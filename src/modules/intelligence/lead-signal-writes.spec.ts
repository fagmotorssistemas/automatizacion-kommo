import { TurnSignals } from './analyze-turn';
import { planLeadSignalWrites } from './lead-signal-writes';

const base: TurnSignals = {
  vehicleUid: null,
  inventoryId: null,
  alertaFaltaDatos: false,
  requiereAtencionVendedor: false,
  detectadoAsesorFinanciamiento: false,
  cedula: null,
  clienteTieneLimitePresupuesto: false,
  montoCliente: null,
  photosJustSent: false,
  respondioPostFotos: null,
  fotosEnviadasAt: null,
  quiereLlamada: false,
  solicitudCliente: 'quiere precio',
  vehiculoResumen: 'Hilux',
  contexto: 'presupuesto 12 mil',
};

describe('planLeadSignalWrites', () => {
  it('no escribe respondio_post_fotos si no aplica', () => {
    expect(planLeadSignalWrites(base).patch).toEqual({});
  });

  it('cliente respondió tras fotos → solo respondio true', () => {
    expect(
      planLeadSignalWrites({
        ...base,
        respondioPostFotos: true,
      }).patch,
    ).toEqual({ respondio_post_fotos: true });
  });

  it('sella fotos_enviadas_at solo si hubo salesbots de foto', () => {
    const writes = planLeadSignalWrites({
      ...base,
      photosJustSent: true,
      respondioPostFotos: false,
      fotosEnviadasAt: '2026-09-14T02:00:00.000Z',
    });
    expect(writes.patch).toEqual({
      respondio_post_fotos: false,
      fotos_enviadas_at: '2026-09-14T02:00:00.000Z',
    });
  });

  it('falta de datos no dispara asesoria_financiamiento', () => {
    const writes = planLeadSignalWrites({
      ...base,
      alertaFaltaDatos: true,
      requiereAtencionVendedor: true,
    });
    expect(writes.patch.status).toBe('datos_pedidos');
    expect(writes.missingData).toEqual({ message: 'quiere precio' });
    expect(writes.financingAdvice).toBeNull();
  });

  it('sin cédula no dispara asesoria_financiamiento', () => {
    const writes = planLeadSignalWrites({
      ...base,
      alertaFaltaDatos: true,
      detectadoAsesorFinanciamiento: true,
      requiereAtencionVendedor: true,
    });
    expect(writes.patch.status).toBe('datos_pedidos');
    expect(writes.patch.cedula).toBeUndefined();
    expect(writes.financingAdvice).toBeNull();
  });

  it('cédula pisa el status y se guarda', () => {
    const writes = planLeadSignalWrites({
      ...base,
      alertaFaltaDatos: true,
      detectadoAsesorFinanciamiento: true,
      cedula: '0102030405',
      requiereAtencionVendedor: true,
    });
    expect(writes.patch.status).toBe('asesoria_financiamiento');
    expect(writes.patch.cedula).toBe('0102030405');
    expect(writes.missingData).not.toBeNull();
    expect(writes.financingAdvice).toEqual({ message: '0102030405' });
  });

  it('presupuesto y llamada solo si las If disparan', () => {
    const writes = planLeadSignalWrites({
      ...base,
      clienteTieneLimitePresupuesto: true,
      quiereLlamada: true,
    });
    expect(writes.patch.presupuesto_cliente).toBe('presupuesto 12 mil');
    expect(writes.patch.quiere_llamada).toBe(true);
  });
});
