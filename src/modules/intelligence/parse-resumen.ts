export type ParsedResumen = {
  vehiculo: string | null;
  contexto: string | null;
  solicitudActual: string | null;
};

export function parseResumen(resumen: string): ParsedResumen {
  const texto = resumen || '';
  const vehiculoMatch = texto.match(/Vehículo:\s*(.+?)(?:\n|$)/i);
  const contextoMatch = texto.match(/Contexto:\s*(.+?)(?:\n\n|\nSOLICITUD|$)/is);
  const solicitudMatch = texto.match(/SOLICITUD ACTUAL:\s*(.+?)$/is);

  return {
    vehiculo: vehiculoMatch?.[1]?.trim() || null,
    contexto: contextoMatch?.[1]?.trim() || null,
    solicitudActual: solicitudMatch?.[1]?.trim() || null,
  };
}
