export type AgentVehicleMeta = {
  inventory_id?: string;
} | null;

export type ParsedAgentOutput = {
  mensaje: string;
  meta: { vehiculo: AgentVehicleMeta };
  img_prefix: string | string[];
};

export type AgentTurnResult = {
  reply: ParsedAgentOutput;
  resumen: string;
};

function cleanText(value: unknown): string {
  return (value ?? '')
    .toString()
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function fromParsed(parsed: Record<string, unknown>, fallback = ''): ParsedAgentOutput {
  const meta = parsed.meta as { vehiculo?: AgentVehicleMeta } | undefined;
  return {
    mensaje: cleanText(parsed.respuesta_cliente ?? fallback),
    meta: { vehiculo: meta?.vehiculo ?? null },
    img_prefix: Array.isArray(parsed.img_prefix)
      ? parsed.img_prefix.map(String)
      : typeof parsed.img_prefix === 'string'
        ? parsed.img_prefix
        : '',
  };
}

/** Parser Datos de n8n. Un solo parser. */
export function parseAgentOutput(raw: string): ParsedAgentOutput {
  const trimmed = (raw || '').trim();

  try {
    return fromParsed(JSON.parse(trimmed) as Record<string, unknown>);
  } catch {
    const index = raw.indexOf('{');
    if (index === -1) {
      return { mensaje: cleanText(raw), meta: { vehiculo: null }, img_prefix: '' };
    }

    const textPart = raw.slice(0, index).trim();
    try {
      return fromParsed(
        JSON.parse(raw.slice(index)) as Record<string, unknown>,
        textPart,
      );
    } catch {
      return { mensaje: cleanText(raw), meta: { vehiculo: null }, img_prefix: '' };
    }
  }
}
