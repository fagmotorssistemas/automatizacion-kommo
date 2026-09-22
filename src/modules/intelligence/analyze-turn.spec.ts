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

  it('sin fotos no pisa respondio_post_fotos', () => {
    const signals = analyzeTurn({
      leadId: '1',
      mensaje: 'ok',
      resumen,
      photoBotsSent: 0,
      customerText: 'hola',
    });
    expect(signals.photosJustSent).toBe(false);
    expect(signals.respondioPostFotos).toBeNull();
    expect(signals.fotosEnviadasAt).toBeNull();
  });

  it('con salesbots de foto sella fotos y deja respondio en false', () => {
    const signals = analyzeTurn({
      leadId: '1',
      mensaje: 'Aquí las fotos',
      resumen,
      photoBotsSent: 1,
      customerText: 'me interesa la hilux',
    });
    expect(signals.photosJustSent).toBe(true);
    expect(signals.respondioPostFotos).toBe(false);
    expect(signals.fotosEnviadasAt).toEqual(expect.any(String));
  });

  it('cliente escribe después de fotos → respondio_post_fotos true', () => {
    const signals = analyzeTurn({
      leadId: '1',
      mensaje: 'Claro',
      resumen,
      photoBotsSent: 0,
      hadFotosEnviadas: true,
      customerText: 'me gusta, ¿cuánto cuesta?',
    });
    expect(signals.respondioPostFotos).toBe(true);
    expect(signals.photosJustSent).toBe(false);
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
