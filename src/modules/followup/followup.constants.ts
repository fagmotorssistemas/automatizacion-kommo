export type SeguimientoEstado = 'activo' | 'aplazado' | 'cerrado';

export type RetomaNumero = 1 | 2 | 3;

export const SEGUIMIENTO_ESTADOS: SeguimientoEstado[] = [
  'activo',
  'aplazado',
  'cerrado',
];

export function isSeguimientoEstado(value: string): value is SeguimientoEstado {
  return (SEGUIMIENTO_ESTADOS as readonly string[]).includes(value);
}

/** Retomas a programar según el estado del análisis. */
export function retomasParaSeguimiento(
  estado: SeguimientoEstado,
): RetomaNumero[] {
  if (estado === 'cerrado') {
    return [];
  }
  if (estado === 'aplazado') {
    return [3];
  }
  return [1, 2, 3];
}

export const FOLLOWUP_INTERVAL_MS = 60_000;
export const FOLLOWUP_BATCH_LIMIT = 20;

/** Un solo salesbot para las 3 retomas; el texto va en campo 3039029. */
export const FOLLOWUP_SALESBOT_ID = 180011;

export const OBJECIONES_CANCELAN_SEGUIMIENTO = new Set([
  'ya_compro',
  'numero_equivocado',
  'fuera_territorio',
]);
