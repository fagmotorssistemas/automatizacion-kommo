import { TurnSignals } from './analyze-turn';
import { planLeadSignalWrites } from './lead-signal-writes';

const base: TurnSignals = {
  vehicleUid: null,
  inventoryId: null,
  alertaFaltaDatos: false,
  requiereAtencionVendedor: false,
  detectadoAsesorFinanciamiento: false,
  clienteTieneLimitePresupuesto: false,
  montoCliente: null,
  respondioPostFotos: true,
  fotosEnviadasAt: '2026-09-14T02:00:00.000Z',
  quiereLlamada: false,
  solicitudCliente: 'quiere precio',
  vehiculoResumen: 'Hilux',
  contexto: 'presupuesto 12 mil',
};

describe('planLeadSignalWrites', () => {
  it('no copia respondio_post_fotos hardcodeado a true', () => {
    expect(planLeadSignalWrites(base).patch).toEqual({
      respondio_post_fotos: true,
    });
  });

  it('sella fotos_enviadas_at solo si hubo prefijos', () => {
    const writes = planLeadSignalWrites({
      ...base,
      respondioPostFotos: false,
    });
    expect(writes.patch.fotos_enviadas_at).toBe(base.fotosEnviadasAt);
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

  it('financiamiento pisa el status si también faltan datos', () => {
    const writes = planLeadSignalWrites({
      ...base,
      alertaFaltaDatos: true,
      detectadoAsesorFinanciamiento: true,
      requiereAtencionVendedor: true,
    });
    expect(writes.patch.status).toBe('asesoria_financiamiento');
    expect(writes.missingData).not.toBeNull();
    expect(writes.financingAdvice).not.toBeNull();
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
