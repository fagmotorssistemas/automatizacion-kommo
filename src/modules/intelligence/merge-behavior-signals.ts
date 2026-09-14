import { BehaviorSignals } from '../persistence/lead.types';

export type { BehaviorSignals };

export type TemperatureResult = {
  behavior_signals: BehaviorSignals;
  temperature: 'frio' | 'tibio' | 'caliente';
  temperature_score: number;
};

const KEYS: (keyof BehaviorSignals)[] = [
  'da_fecha_visita',
  'confirma_visita',
  'urgencia_compra',
  'interes_financiamiento',
  'financiamiento_detallado',
  'entrada_significativa',
  'interes_retoma',
  'comparacion_activa',
  'baja_intencion',
  'presupuesto_mencionado',
];

function flag(source: Partial<BehaviorSignals> | null | undefined, key: keyof BehaviorSignals): boolean {
  return Boolean(source?.[key]);
}

/** MERGE DE SEÑALES: OR persistente + score de temperatura. */
export function mergeBehaviorSignals(
  oldSignals: Partial<BehaviorSignals> | null | undefined,
  newSignals: Partial<BehaviorSignals> | null | undefined,
): TemperatureResult {
  const merged = {} as BehaviorSignals;
  for (const key of KEYS) {
    merged[key] = flag(oldSignals, key) || flag(newSignals, key);
  }

  if (newSignals?.baja_intencion === true && oldSignals?.baja_intencion !== true) {
    merged.da_fecha_visita = false;
    merged.confirma_visita = false;
    merged.urgencia_compra = false;
  }

  let score = 0;
  if (merged.confirma_visita) score += 10;
  if (merged.da_fecha_visita) score += 8;
  if (merged.urgencia_compra) score += 7;
  if (merged.entrada_significativa) score += 6;
  if (merged.financiamiento_detallado) score += 4;
  if (merged.interes_retoma) score += 3;
  if (merged.comparacion_activa) score += 2;
  if (merged.interes_financiamiento) score += 2;
  if (merged.presupuesto_mencionado) score += 4;
  if (merged.baja_intencion) score -= 5;

  const temperature =
    score >= 10 ? 'caliente' : score >= 4 ? 'tibio' : 'frio';

  return { behavior_signals: merged, temperature, temperature_score: score };
}
