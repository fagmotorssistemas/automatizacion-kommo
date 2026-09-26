/**
 * Solo la palabra exacta "cedula" abre el lector del documento.
 * Cualquier otra respuesta (carro, duda, frase) se queda en vehículo.
 */
export function parseImageKind(raw: string | null): 'cedula' | 'vehiculo' {
  const text = (raw ?? '').trim();
  if (!text) {
    return 'vehiculo';
  }

  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as { tipo?: unknown };
      if (typeof parsed?.tipo === 'string') {
        return lettersOnly(parsed.tipo) === 'cedula' ? 'cedula' : 'vehiculo';
      }
    } catch {
      /* sigue con el texto plano */
    }
  }

  return lettersOnly(text) === 'cedula' ? 'cedula' : 'vehiculo';
}

function lettersOnly(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}
