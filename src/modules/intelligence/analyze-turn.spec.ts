import { analyzeTurn } from './analyze-turn';
import { buildVehicleUid } from './vehicle-uid';

describe('analyzeTurn', () => {
  const resumen = `RESUMEN PREVIO:
Vehículo: Hilux
Contexto: pidió precio

SOLICITUD ACTUAL:
Cliente quiere financiamiento de la hilux.`;

  it('arma vehicle_uid solo con inventory_id', () => {
    expect(buildVehicleUid('41807269', 'inv-1')).toEqual(expect.any(String));
    expect(buildVehicleUid('41807269', null)).toBeNull();
  });

  it('marca falta de datos y atención', () => {
    const signals = analyzeTurn({
      leadId: '1',
      mensaje: 'En este momento no tengo ese dato exacto en el sistema',
      resumen,
    });
    expect(signals.alertaFaltaDatos).toBe(true);
    expect(signals.requiereAtencionVendedor).toBe(true);
  });

  it('pedir cuota no es asesoría; la cédula sí', () => {
    expect(
      analyzeTurn({
        leadId: '1',
        mensaje: 'Un asesor se comunicará para el financiamiento',
        resumen,
        customerText: 'cuánto quedaría la cuota',
      }).detectadoAsesorFinanciamiento,
    ).toBe(false);
    const conCedula = analyzeTurn({
      leadId: '1',
      mensaje: 'La cuota queda en 280.',
      resumen,
      customerText: 'mi cedula es 0102030405',
    });
    expect(conCedula.detectadoAsesorFinanciamiento).toBe(true);
    expect(conCedula.cedula).toBe('0102030405');
    expect(conCedula.requiereAtencionVendedor).toBe(true);
  });

  it('sin img_prefix es respondio_post_fotos', () => {
    expect(
      analyzeTurn({
        leadId: '1',
        mensaje: 'ok',
        resumen,
        imgPrefix: '',
      }).respondioPostFotos,
    ).toBe(true);
  });

  it('detecta que quiere llamada', () => {
    const signals = analyzeTurn({
      leadId: '1',
      mensaje: 'ok',
      resumen: `SOLICITUD ACTUAL:
Cliente quiere que le llamen.`,
    });
    expect(signals.quiereLlamada).toBe(true);
  });
});
