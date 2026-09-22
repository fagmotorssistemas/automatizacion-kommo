import { isObjecionTipo, ObjecionTipo } from './objecion';

export type ConversationReading = {
  objecionPrincipal: ObjecionTipo;
  objecionTexto: string;
  objecionEvidencia: string;
  agendoVisita: boolean;
  resumen: string;
  presupuestoDeclarado: string | null;
};

export function parseConversationReading(raw: unknown): ConversationReading | null {
  const row =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  if (!row) {
    return null;
  }

  const objecion = String(row.objecion_principal ?? '');
  const resumen = String(row.resumen ?? '').trim();
  const evidencia = String(row.objecion_evidencia ?? '').trim();
  if (!isObjecionTipo(objecion) || !resumen || !evidencia) {
    return null;
  }

  const presupuesto = String(row.presupuesto_declarado ?? '').trim();
  return {
    objecionPrincipal: objecion,
    objecionTexto: String(row.objecion_texto ?? '').trim(),
    objecionEvidencia: evidencia,
    agendoVisita: row.agendo_visita === true,
    resumen,
    presupuestoDeclarado: presupuesto || null,
  };
}
