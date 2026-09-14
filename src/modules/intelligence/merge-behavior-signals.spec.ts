import { mergeBehaviorSignals } from './merge-behavior-signals';

describe('mergeBehaviorSignals', () => {
  it('OR persistente y score caliente', () => {
    const result = mergeBehaviorSignals(
      { interes_financiamiento: true },
      { confirma_visita: true },
    );
    expect(result.behavior_signals.interes_financiamiento).toBe(true);
    expect(result.behavior_signals.confirma_visita).toBe(true);
    expect(result.temperature).toBe('caliente');
    expect(result.temperature_score).toBe(12);
  });

  it('baja_intencion nueva apaga visita/urgencia', () => {
    const result = mergeBehaviorSignals(
      { da_fecha_visita: true, confirma_visita: true },
      { baja_intencion: true },
    );
    expect(result.behavior_signals.da_fecha_visita).toBe(false);
    expect(result.behavior_signals.confirma_visita).toBe(false);
    expect(result.behavior_signals.baja_intencion).toBe(true);
  });
});
