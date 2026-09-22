/** 0-4 y 6 en SQL. 5 la pone el LLM. 7 es factura, aún no. */
export function etapaFromFlags(input: {
  propios: number;
  precioMostrado: boolean;
  cuotaMostrada: boolean;
  visito?: boolean;
}): number {
  const propios = Number.isFinite(input.propios) ? input.propios : 0;
  if (input.visito && propios >= 2) {
    return 6;
  }
  if (input.cuotaMostrada && propios >= 2) {
    return 4;
  }
  if (input.precioMostrado && propios >= 2) {
    return 3;
  }
  if (propios >= 2) {
    return 2;
  }
  if (propios >= 1) {
    return 1;
  }
  return 0;
}
