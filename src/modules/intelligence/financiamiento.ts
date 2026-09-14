export type FinanciamientoInput = {
  precio: number;
  entrada_cliente?: number | null;
  entrada_porcentaje?: number | null;
  anos?: number | null;
};

function resolveEntrada(data: FinanciamientoInput): number | null {
  if (data.entrada_cliente != null) {
    return data.entrada_cliente;
  }
  if (data.entrada_porcentaje != null) {
    return Math.round(data.precio * (data.entrada_porcentaje / 100) * 100) / 100;
  }
  return null;
}

/** Tool calcular_financiamiento (CrediFAG / camino A vs banco). */
export function calcularFinanciamiento(data: FinanciamientoInput): string {
  const entrada = resolveEntrada(data);
  if (data.precio == null || entrada == null) {
    return JSON.stringify({
      error: true,
      mensaje: 'Falta indicar la entrada, ya sea en monto fijo o en porcentaje.',
    });
  }

  const minimo = Math.round(data.precio * 0.6 * 100) / 100;
  if (entrada >= minimo) {
    const saldo = data.precio - entrada;
    const seguro = data.precio * 0.05;
    const totalBase = saldo + seguro + 686 + 386;
    const meses = 36;
    const interesTotal = totalBase * 0.018 * meses;
    const cuota = Math.round(((totalBase + interesTotal) / meses) * 100) / 100;
    return JSON.stringify({
      camino: 'A',
      entrada_usada: entrada,
      cuota_aprox: cuota,
      disclaimer:
        'Este es un valor aproximado y referencial. El monto definitivo lo confirma un asesor en la concesionaria.',
    });
  }

  return JSON.stringify({
    camino: 'B',
    requiere_plazo_anos: true,
    disclaimer:
      'Para este tipo de crédito necesito saber a cuántos años deseas financiar.',
  });
}

/** Tool calcular_financiamiento_bancario. */
export function calcularFinanciamientoBancario(data: FinanciamientoInput): string {
  const entrada = resolveEntrada(data);
  if (entrada == null) {
    return JSON.stringify({
      error: true,
      mensaje: 'Falta indicar la entrada, ya sea en monto fijo o en porcentaje.',
    });
  }
  if (data.anos == null) {
    return JSON.stringify({
      error: true,
      mensaje: 'Falta indicar a cuántos años desea financiar.',
    });
  }

  const montoBase = data.precio - entrada + 450;
  const meses = data.anos * 12;
  const interesTotal = montoBase * (0.156 / 12) * meses;
  const cuota =
    Math.round(((montoBase + interesTotal) / meses) * 100) / 100;

  return JSON.stringify({
    camino: 'B',
    entrada_usada: entrada,
    cuota_aprox: cuota,
    meses,
    disclaimer:
      'Este valor es referencial y usa una tasa de interés promedio del mercado (no la tasa real del banco). El monto final, la tasa, el plazo y las condiciones los define directamente el banco o cooperativa. Un asesor se comunicará con usted.',
  });
}
