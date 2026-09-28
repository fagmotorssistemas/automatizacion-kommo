export const LEAD_COLUMNS =
  'id, contact_id, lead_id_kommo, name, phone, source, assigned_to, mensajes_enviados, behavior_signals, bot_apagado, bot_apagado_at, ultimo_mensaje_ignorado, handoff_transcript, handoff_resumen, fotos_enviadas_at, cedula, nombre_cedula, origen';

export function isMissingLeadIdentityColumn(
  message: string | null | undefined,
): boolean {
  const text = message ?? '';
  return (
    text.includes('column leads.nombre_cedula does not exist') ||
    text.includes('column leads.origen does not exist')
  );
}

export function omitLeadIdentityFields<T extends Record<string, unknown>>(
  patch: T,
): T {
  const next = { ...patch };
  delete next.nombre_cedula;
  delete next.origen;
  return next;
}
