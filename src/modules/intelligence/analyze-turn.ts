import { DEALERSHIP_TIMEZONE } from './dealership-hours';
import { extractCedula } from './extract-cedula';
import { parseResumen } from './parse-resumen';
import { buildVehicleUid } from './vehicle-uid';

export type TurnSignals = {
  vehicleUid: string | null;
  inventoryId: string | null;
  alertaFaltaDatos: boolean;
  requiereAtencionVendedor: boolean;
  detectadoAsesorFinanciamiento: boolean;
  cedula: string | null;
  clienteTieneLimitePresupuesto: boolean;
  montoCliente: number | null;
  /** Este turno disparó salesbots de foto. */
  photosJustSent: boolean;
  /**
   * true = el cliente escribió después de que ya había fotos.
   * false = acabamos de enviar fotos (queda pendiente de respuesta).
   * null = no tocar el flag en DB.
   */
  respondioPostFotos: boolean | null;
  fotosEnviadasAt: string | null;
  quiereLlamada: boolean;
  solicitudCliente: string | null;
  vehiculoResumen: string | null;
  contexto: string | null;
};

const FALTA_DATOS =
  'en este momento no tengo ese dato exacto en el sistema';

const FRASES_BUDGET = [
  'fuera de su presupuesto',
  'fuera de mi presupuesto',
  'presupuesto de',
  'no tengo ese dinero',
  'se sale de mi presupuesto',
  'solo tengo',
  'solo dispongo',
];

const MAPA_NUMEROS: Record<string, number> = {
  cien: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900,
  mil: 1000,
  'dos mil': 2000,
  'tres mil': 3000,
  'cuatro mil': 4000,
  'cinco mil': 5000,
  'seis mil': 6000,
  'siete mil': 7000,
  'ocho mil': 8000,
  'nueve mil': 9000,
  'diez mil': 10000,
  'once mil': 11000,
  'doce mil': 12000,
  'quince mil': 15000,
  'veinte mil': 20000,
  'treinta mil': 30000,
};

function extractMonto(texto: string): number | null {
  const matchDigitos = texto.match(
    /dispone\s+de\s+[\$]?\s*([\d.,]+)\s*(mil)?/i,
  );
  if (matchDigitos) {
    let numero = Number.parseFloat(
      matchDigitos[1].replace(/\./g, '').replace(',', '.'),
    );
    if (matchDigitos[2]) {
      numero *= 1000;
    }
    return Number.isFinite(numero) ? numero : null;
  }

  const patron = Object.keys(MAPA_NUMEROS).join('|');
  const matchEscrito = texto.match(new RegExp(`dispone\\s+de\\s+(${patron})`, 'i'));
  if (matchEscrito) {
    return MAPA_NUMEROS[matchEscrito[1].toLowerCase()] ?? null;
  }
  return null;
}

function nowInEcuadorIso(now = new Date()): string {
  const local = new Date(
    now.toLocaleString('en-US', { timeZone: DEALERSHIP_TIMEZONE }),
  );
  return local.toISOString();
}

/** Junta los 7 Code de n8n en una pasada. El hilo durable va a n8n_chat_histories aparte. */
export function analyzeTurn(input: {
  leadId: string;
  mensaje: string;
  resumen: string;
  customerText?: string;
  inventoryId?: string | null;
  /** Cuántos salesbots de foto se dispararon (bot_id). Antes era img_prefix. */
  photoBotsSent?: number;
  /** Ya había fotos_enviadas_at en el lead (turno anterior). */
  hadFotosEnviadas?: boolean;
}): TurnSignals {
  const mensaje = input.mensaje || '';
  const lower = mensaje.toLowerCase();
  const resumen = parseResumen(input.resumen);
  const textoBusqueda = `${resumen.contexto ?? ''} ${input.resumen}`.toLowerCase();

  const alertaFaltaDatos = lower.includes(FALTA_DATOS);
  const cedula = extractCedula(input.customerText ?? '');
  const detectadoAsesorFinanciamiento = cedula !== null;

  const montoCliente = extractMonto(textoBusqueda);
  const clienteTieneLimitePresupuesto =
    FRASES_BUDGET.some((frase) => textoBusqueda.includes(frase)) ||
    montoCliente !== null;

  const quiereLlamada = resumen.solicitudActual
    ? /\b(llame|llamen|llamar|me llame|me llamen|call\s*me|call\s*back)\b/i.test(
        resumen.solicitudActual,
      )
    : false;

  const photosJustSent = (input.photoBotsSent ?? 0) > 0;
  const customerReplied = Boolean(input.customerText?.trim());
  const hadFotos = input.hadFotosEnviadas === true;

  let respondioPostFotos: boolean | null = null;
  if (photosJustSent) {
    respondioPostFotos = false;
  } else if (customerReplied && hadFotos) {
    respondioPostFotos = true;
  }

  return {
    vehicleUid: buildVehicleUid(input.leadId, input.inventoryId),
    inventoryId: input.inventoryId || null,
    alertaFaltaDatos,
    requiereAtencionVendedor: alertaFaltaDatos || detectadoAsesorFinanciamiento,
    detectadoAsesorFinanciamiento,
    cedula,
    clienteTieneLimitePresupuesto,
    montoCliente,
    photosJustSent,
    respondioPostFotos,
    fotosEnviadasAt: photosJustSent ? nowInEcuadorIso() : null,
    quiereLlamada,
    solicitudCliente: resumen.solicitudActual,
    vehiculoResumen: resumen.vehiculo,
    contexto: resumen.contexto,
  };
}
