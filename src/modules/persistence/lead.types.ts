import { HandoffTurn } from './parse-handoff-turns';

export type { HandoffTurn };

export type PersistLeadInput = {
  contactId: string;
  leadIdKommo: string;
  name: string;
  phone: string | null;
  source: string;
  assignedTo?: string | null;
};

export type RecoveryStep = '2d' | '7d' | '15d' | '30d';

export type BehaviorSignals = {
  da_fecha_visita: boolean;
  confirma_visita: boolean;
  urgencia_compra: boolean;
  interes_financiamiento: boolean;
  financiamiento_detallado: boolean;
  entrada_significativa: boolean;
  interes_retoma: boolean;
  comparacion_activa: boolean;
  baja_intencion: boolean;
  presupuesto_mencionado: boolean;
};

export type LeadRow = {
  id: string;
  contactId: string;
  leadIdKommo: string;
  name: string;
  phone: string;
  source: string;
  assignedTo: string | null;
  mensajesEnviados: string[];
  behaviorSignals: Partial<BehaviorSignals>;
  botApagado?: boolean;
  botApagadoAt?: string | null;
  ultimoMensajeIgnorado?: string | null;
  handoffTurns?: HandoffTurn[];
  handoffResumen?: string | null;
  /** ISO de cuándo se mandaron fotos; null = aún no. */
  fotosEnviadasAt?: string | null;
};

export type HandoffBrief = {
  leadId: string;
  turns: HandoffTurn[];
  resumen: string | null;
};

export type StoppedHandoffInput = PersistLeadInput & {
  role: 'customer' | 'seller';
  text: string;
  authorName?: string;
};

export type LeadAnalysisPatch = {
  budget?: unknown;
  temperature?: string;
  behavior_signals?: BehaviorSignals;
  day_detected?: string | null;
  hour_detected?: string | null;
  time_reference?: string | null;
  cedula?: string;
};

export type TradeInInput = {
  leadId: string;
  brand: string;
  model: string | null;
  year: unknown;
};

export type LeadRecoveryPatch = {
  leadId: string;
  step: RecoveryStep;
  response: string;
  responseText: string;
  stop: boolean;
};

export type LeadStatus =
  | 'datos_pedidos'
  | 'asesoria_financiamiento';

export type LeadSignalPatch = {
  respondio_post_fotos?: boolean;
  fotos_enviadas_at?: string;
  quiere_llamada?: boolean;
  status?: LeadStatus;
  presupuesto_cliente?: string;
  cedula?: string;
};

export type RequestedClientDataInput = {
  leadId: string;
  message: string;
};

export type LeadSignalWrites = {
  patch: LeadSignalPatch;
  missingData: { message: string } | null;
  financingAdvice: { message: string } | null;
};

export type EnsureLeadResult =
  | { status: 'created'; lead: LeadRow }
  | { status: 'existing'; lead: LeadRow }
  | { status: 'skipped' }
  | { status: 'unavailable' };

export type InterestedCarInput = {
  leadId: string;
  inventoryId: string;
  vehicleUid: string;
};

export type InterestedCarSnapshot = {
  inventoryId: string;
  brand: string;
  model: string;
  year: number | null;
  price: number | null;
  typeBody?: string | null;
};

export type CtwaMatch = {
  matched: boolean;
  adHeadline: string | null;
  capturedAt: string | null;
};
