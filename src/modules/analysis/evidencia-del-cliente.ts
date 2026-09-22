function normalizar(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function textoDelCliente(transcript: string): string {
  return transcript
    .split(/\r?\n/)
    .filter((line) => line.startsWith('[cliente] '))
    .map((line) => line.slice('[cliente] '.length))
    .join('\n');
}

/** La evidencia tiene que ser una cita del cliente, no del bot ni un parafraseo. */
export function evidenciaEsDelCliente(
  transcript: string,
  evidencia: string,
): boolean {
  const cita = normalizar(evidencia).replace(/^\[cliente\]\s*/, '');
  if (cita.length < 2 || /\{.*\}/.test(evidencia)) {
    return false;
  }
  return normalizar(textoDelCliente(transcript)).includes(cita);
}
