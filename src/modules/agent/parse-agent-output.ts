import type { EntregadoEnHilo } from '../conversation/entregado-en-hilo';
import type { TurnPlanLog } from '../intelligence/turn-plan';
import type { UnidadContexto } from './unidades-contexto';
import type { CorreccionNumero } from './validar-numeros';

export type AgentVehicleMeta = {
  inventory_id?: string;
  precio?: number;
} | null;

export type AgentMeta = {
  precioMostrado: boolean;
  cuotaMostrada: boolean;
  vehiculo: AgentVehicleMeta;
};

export type ParsedAgentOutput = {
  mensaje: string;
  meta: AgentMeta;
  img_prefix: string | string[];
};

export type PhotoQueueItem = {
  inventoryId: string;
  label: string;
};

export type AgentTurnResult = {
  reply: ParsedAgentOutput;
  resumen: string;
  photoQueue?: PhotoQueueItem[];
  /** Esta unidad ya tuvo ficha en el hilo. Outbound no reabre fotos. */
  alreadyShownInThread?: boolean;
  /**
   * Plan en sombra: qué habría decidido el resumen vs qué hizo el camino viejo.
   * Solo se registra; no cambia la respuesta.
   */
  plan?: TurnPlanLog;
  /** Piezas que el bot ya había entregado en el hilo al empezar el turno. */
  entregado?: EntregadoEnHilo;
  numerosCorregidos?: CorreccionNumero[];
  regenerado?: boolean;
  hechos?: Array<{ id: string; km: number | null; precio: number | null }>;
  /** Unidades cuya ficha o datos vio el modelo en este turno. Solo id y origen. */
  unidadesContexto?: UnidadContexto[];
  /** El cliente pidió un asesor; se registró (Kommo no crea tareas aún). */
  asesorPedido?: boolean;
  /** Pide precio: sí y la respuesta no trae el $ de la unidad pedida. */
  respuestaIncompleta?: boolean;
  /** El turno pedía aclarar que ese año no hay y la respuesta no lo dijo. */
  faltaAclararNoExiste?: { pedido: string; ofrecido: string };
  /** Respuesta cruda del LLM, antes de postprocesos. */
  rawLlm?: string;
  /** Dijo que no hay y el turno no tenía ficha de esa unidad. */
  negacionSinContexto?: boolean;
  /** El control final quitó nombres de campos internos del mensaje. */
  campoFiltrado?: boolean;
  /** La respuesta mencionó una placa que no coincide con la unidad de referencia. */
  placaNoCoincide?: { dijo: string; correcto: string };
};

const EMPTY_META: AgentMeta = {
  precioMostrado: false,
  cuotaMostrada: false,
  vehiculo: null,
};

function cleanText(value: unknown): string {
  return (value ?? '')
    .toString()
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asVehicle(value: unknown): AgentVehicleMeta {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const inventoryId = row.inventory_id ? String(row.inventory_id) : '';
  const precio = Number(row.precio);
  const vehicle: { inventory_id?: string; precio?: number } = {};
  if (inventoryId) {
    vehicle.inventory_id = inventoryId;
  }
  if (Number.isFinite(precio) && precio > 0) {
    vehicle.precio = precio;
  }
  return vehicle.inventory_id || vehicle.precio ? vehicle : null;
}

function fromParsed(parsed: Record<string, unknown>, fallback = ''): ParsedAgentOutput {
  const meta = asRecord(parsed.meta);
  return {
    mensaje: cleanText(parsed.respuesta_cliente ?? fallback),
    meta: {
      precioMostrado: meta?.precio_mostrado === true,
      cuotaMostrada: meta?.cuota_mostrada === true,
      vehiculo: asVehicle(meta?.vehiculo),
    },
    img_prefix: Array.isArray(parsed.img_prefix)
      ? parsed.img_prefix.map(String)
      : typeof parsed.img_prefix === 'string'
        ? parsed.img_prefix
        : '',
  };
}

export function serializeAgentTurn(parsed: ParsedAgentOutput): string {
  return JSON.stringify({
    respuesta_cliente: parsed.mensaje,
    meta: {
      precio_mostrado: parsed.meta.precioMostrado,
      cuota_mostrada: parsed.meta.cuotaMostrada,
      vehiculo: parsed.meta.vehiculo,
    },
  });
}

/** Primer `{...}` con llaves balanceadas, aunque vengan dos objetos o texto alrededor. */
export function firstBalancedJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start === -1) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }
  return null;
}

/** El texto que iría al cliente todavía es el JSON del modelo. */
export function looksLikeAgentJson(text: string): boolean {
  const t = (text || '').trim();
  if (!t) {
    return false;
  }
  if (t.startsWith('{{')) {
    return false;
  }
  if (t.startsWith('{')) {
    return true;
  }
  return /respuesta_cliente|"inventory_id"|img_prefix/.test(t);
}

function mensajeDesdeRawJson(raw: string): string | null {
  const match = raw.match(
    /"respuesta_cliente"\s*:\s*"((?:\\.|[^"\\])*)"/,
  );
  if (!match) {
    return null;
  }
  try {
    return String(JSON.parse(`"${match[1]}"`));
  } catch {
    return match[1];
  }
}

/** Parser Datos de n8n. Un solo parser. */
export function parseAgentOutput(raw: string): ParsedAgentOutput {
  const trimmed = (raw || '').trim();

  try {
    return fromParsed(JSON.parse(trimmed) as Record<string, unknown>);
  } catch {
    const block = firstBalancedJsonObject(raw);
    if (!block) {
      return { mensaje: cleanText(raw), meta: { ...EMPTY_META }, img_prefix: '' };
    }
    const textPart = raw.slice(0, raw.indexOf('{')).trim();
    try {
      return fromParsed(
        JSON.parse(block) as Record<string, unknown>,
        textPart,
      );
    } catch {
      return { mensaje: cleanText(raw), meta: { ...EMPTY_META }, img_prefix: '' };
    }
  }
}

export function extractClientMessage(raw: string): ParsedAgentOutput {
  const parsed = parseAgentOutput(raw);
  if (!looksLikeAgentJson(parsed.mensaje)) {
    return parsed;
  }
  const fromField = mensajeDesdeRawJson(raw);
  if (fromField && !looksLikeAgentJson(fromField)) {
    return { ...parsed, mensaje: cleanText(fromField) };
  }
  return {
    ...parsed,
    mensaje: '¿Qué carro le interesa?',
  };
}
