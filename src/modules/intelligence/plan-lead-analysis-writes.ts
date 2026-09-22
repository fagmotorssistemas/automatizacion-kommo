import {
  BehaviorSignals,
  LeadAnalysisPatch,
  TradeInInput,
} from '../persistence/lead.types';
import { mergeBehaviorSignals } from './merge-behavior-signals';
import { ParsedLeadAnalysis } from './parse-lead-analysis';
import { resolveVisitTime } from './parse-visit-time';

export type LeadAnalysisWrites = {
  patch: LeadAnalysisPatch;
  tradeIn: TradeInInput | null;
};

export function planLeadAnalysisWrites(input: {
  leadId: string;
  analysis: ParsedLeadAnalysis;
  oldSignals?: Partial<BehaviorSignals> | null;
  now?: Date;
}): LeadAnalysisWrites {
  const patch: LeadAnalysisPatch = {};

  if (input.analysis.financing) {
    patch.budget = input.analysis.financing.budget;
  }

  if (input.analysis.signals) {
    const merged = mergeBehaviorSignals(input.oldSignals, input.analysis.signals);
    patch.behavior_signals = merged.behavior_signals;
    patch.temperature = merged.temperature;
  }

  if (input.analysis.identity?.ci) {
    patch.cedula = input.analysis.identity.ci;
  }

  if (input.analysis.visitTime) {
    const visit = resolveVisitTime(input.analysis.visitTime, input.now);
    patch.day_detected = visit.day_detected;
    patch.hour_detected = visit.hour_detected;
    patch.time_reference = visit.visit_datetime;
  }

  const trade = input.analysis.tradeIn;
  return {
    patch,
    tradeIn: trade
      ? {
          leadId: input.leadId,
          brand: trade.brand || 'sin marca',
          model: trade.model,
          year: trade.year,
        }
      : null,
  };
}
