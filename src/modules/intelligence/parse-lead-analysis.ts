import { extractCedula } from './extract-cedula';

export type FinancingAction = {
  budget: unknown;
  financing: unknown;
};

export type TradeInAction = {
  brand: string | null;
  model: string | null;
  year: unknown;
  mileage: unknown;
};

export type SignalFlags = {
  da_fecha_visita: boolean;
  confirma_visita: boolean;
  urgencia_compra: boolean;
  interes_financiamiento: boolean;
  presupuesto_mencionado: boolean;
  financiamiento_detallado: boolean;
  interes_retoma: boolean;
  comparacion_activa: boolean;
  baja_intencion: boolean;
};

export type VisitTimeHint = {
  time_reference: string | null;
  day_detected: string | null;
  hour_detected: string | null;
};

export type IdentityAction = {
  ci: string;
};

export type ParsedLeadAnalysis = {
  financing: FinancingAction | null;
  tradeIn: TradeInAction | null;
  signals: SignalFlags | null;
  visitTime: VisitTimeHint | null;
  identity: IdentityAction | null;
};

function tryParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractFirstJsonObject(value: string): string | null {
  let text = value
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  const start = text.indexOf('{');
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      depth += 1;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toNull(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

/** Code in JavaScript: saca financing / trade_in / signals / visit_time / identity.ci. */
export function parseLeadAnalysis(raw: unknown): ParsedLeadAnalysis | null {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    parsed = tryParse(raw) || tryParse(extractFirstJsonObject(raw) ?? '');
  }

  const root = asRecord(parsed);
  if (!root) {
    return null;
  }

  const actions = Array.isArray(root.actions) ? root.actions : [];
  const financingAction = actions.find(
    (item) => asRecord(item)?.action === 'financing',
  );
  const tradeInAction = actions.find(
    (item) => asRecord(item)?.action === 'trade_in',
  );
  const signalsAction = actions.find(
    (item) => asRecord(item)?.action === 'signals',
  );
  const identityAction = actions.find(
    (item) => asRecord(item)?.action === 'identity',
  );

  const financingRaw = asRecord(financingAction);
  let financing: FinancingAction | null = null;
  if (
    financingRaw &&
    (financingRaw.budget !== null || financingRaw.financing !== null)
  ) {
    financing = {
      budget: financingRaw.budget ?? null,
      financing: financingRaw.financing ?? null,
    };
  }

  const tradeRaw = asRecord(tradeInAction);
  let tradeIn: TradeInAction | null = null;
  if (
    tradeRaw &&
    (tradeRaw.brand || tradeRaw.model || tradeRaw.year || tradeRaw.mileage)
  ) {
    tradeIn = {
      brand: tradeRaw.brand ? String(tradeRaw.brand) : null,
      model: tradeRaw.model ? String(tradeRaw.model) : null,
      year: tradeRaw.year ?? null,
      mileage: tradeRaw.mileage ?? null,
    };
  }

  const signalsRaw = asRecord(signalsAction);
  const signals = signalsRaw
    ? {
        da_fecha_visita: asBoolean(signalsRaw.da_fecha_visita),
        confirma_visita: asBoolean(signalsRaw.confirma_visita),
        urgencia_compra: asBoolean(signalsRaw.urgencia_compra),
        interes_financiamiento: asBoolean(signalsRaw.interes_financiamiento),
        presupuesto_mencionado: asBoolean(signalsRaw.presupuesto_mencionado),
        financiamiento_detallado: asBoolean(signalsRaw.financiamiento_detallado),
        interes_retoma: asBoolean(signalsRaw.interes_retoma),
        comparacion_activa: asBoolean(signalsRaw.comparacion_activa),
        baja_intencion: asBoolean(signalsRaw.baja_intencion),
      }
    : null;

  let visitSource = asRecord(root.visit_time);
  if (!visitSource && root.action === 'visit_time') {
    visitSource = root;
  }

  let visitTime: VisitTimeHint | null = null;
  if (visitSource) {
    const time_reference = toNull(visitSource.time_reference);
    const day_detected = toNull(visitSource.day_detected);
    const hour_detected = toNull(visitSource.hour_detected);
    if (time_reference || day_detected || hour_detected) {
      visitTime = { time_reference, day_detected, hour_detected };
    }
  }

  const identityRaw = asRecord(identityAction);
  const ci = identityRaw ? extractCedula(String(identityRaw.ci ?? '')) : null;
  const identity = ci ? { ci } : null;

  return { financing, tradeIn, signals, visitTime, identity };
}

export function leadAnalyzerUserPrompt(
  agentMessage: string,
  customerMessage: string,
): string {
  return `mensaje_agente: ${agentMessage || ''}\nmensaje_cliente: ${customerMessage || ''}`;
}
