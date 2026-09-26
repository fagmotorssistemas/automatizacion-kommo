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

/** Parser Datos de n8n. Un solo parser. */
export function parseAgentOutput(raw: string): ParsedAgentOutput {
  const trimmed = (raw || '').trim();

  try {
    return fromParsed(JSON.parse(trimmed) as Record<string, unknown>);
  } catch {
    const index = raw.indexOf('{');
    if (index === -1) {
      return { mensaje: cleanText(raw), meta: { ...EMPTY_META }, img_prefix: '' };
    }

    const textPart = raw.slice(0, index).trim();
    try {
      return fromParsed(
        JSON.parse(raw.slice(index)) as Record<string, unknown>,
        textPart,
      );
    } catch {
      return { mensaje: cleanText(raw), meta: { ...EMPTY_META }, img_prefix: '' };
    }
  }
}
