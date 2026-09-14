import { parseImgPrefixes } from '../catalog/parse-img-prefixes';
import { DEALERSHIP_TIMEZONE } from './dealership-hours';
import { parseResumen } from './parse-resumen';
import { buildVehicleUid } from './vehicle-uid';

export type TurnSignals = {
  vehicleUid: string | null;
  inventoryId: string | null;
  alertaFaltaDatos: boolean;
  requiereAtencionVendedor: boolean;
  detectadoAsesorFinanciamiento: boolean;
  clienteTieneLimitePresupuesto: boolean;
  montoCliente: number | null;
  respondioPostFotos: boolean;
  fotosEnviadasAt: string;
  quiereLlamada: boolean;
  solicitudCliente: string | null;
  vehiculoResumen: string | null;
  contexto: string | null;
};

const FALTA_DATOS =
  'en este momento no tengo ese dato exacto en el sistema';

const ASESOR = ['asesor'];
const ACCION = [
  'comunicará',
  'contactará',
  'llamará',
  'escribirá',
  'ayudará',
  'ayudarle',
  'continuar',
  'seguimiento',
];
const CONTEXTO_FINAN = [
  'financiamiento',
  'financiar',
  'crédito',
  'cuota',
  'banco',
  'cooperativa',
  'plazo',
  'entrada',
];

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

function containsAny(texto: string, palabras: string[]): boolean {
  return palabras.some((word) => texto.includes(word));
}

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

/** Junta los 7 Code de n8n en una pasada. No lee n8n_chat_histories. */
export function analyzeTurn(input: {
  leadId: string;
  mensaje: string;
  resumen: string;
  inventoryId?: string | null;
  imgPrefix?: unknown;
}): TurnSignals {
  const mensaje = input.mensaje || '';
  const lower = mensaje.toLowerCase();
  const resumen = parseResumen(input.resumen);
  const textoBusqueda = `${resumen.contexto ?? ''} ${input.resumen}`.toLowerCase();

  const alertaFaltaDatos = lower.includes(FALTA_DATOS);
  const tieneAsesor = containsAny(lower, ASESOR);
  const tieneAccion =
    containsAny(lower, ACCION) ||
    /asesor.*(comunic|contact|llam|escrib|ayud|seguim)/i.test(mensaje);
  const detectadoAsesor = tieneAsesor && tieneAccion;
  const detectadoAsesorFinanciamiento =
    detectadoAsesor &&
    (containsAny(lower, CONTEXTO_FINAN) ||
      /(financ|cr[eé]dito|cuota|banco|cooperativa|plazo|entrada)/i.test(mensaje));

  const montoCliente = extractMonto(textoBusqueda);
  const clienteTieneLimitePresupuesto =
    FRASES_BUDGET.some((frase) => textoBusqueda.includes(frase)) ||
    montoCliente !== null;

  const quiereLlamada = resumen.solicitudActual
    ? /\b(llame|llamen|llamar|me llame|me llamen|call\s*me|call\s*back)\b/i.test(
        resumen.solicitudActual,
      )
    : false;

  return {
    vehicleUid: buildVehicleUid(input.leadId, input.inventoryId),
    inventoryId: input.inventoryId || null,
    alertaFaltaDatos,
    requiereAtencionVendedor: alertaFaltaDatos || detectadoAsesorFinanciamiento,
    detectadoAsesorFinanciamiento,
    clienteTieneLimitePresupuesto,
    montoCliente,
    respondioPostFotos: parseImgPrefixes(input.imgPrefix).length === 0,
    fotosEnviadasAt: nowInEcuadorIso(),
    quiereLlamada,
    solicitudCliente: resumen.solicitudActual,
    vehiculoResumen: resumen.vehiculo,
    contexto: resumen.contexto,
  };
}
