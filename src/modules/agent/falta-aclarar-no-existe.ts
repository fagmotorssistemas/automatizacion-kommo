/** El dato pedido está cerca de una negación (no / no hay / no tenemos / no contamos). */
export function respuestaAclaraNoExiste(
  mensaje: string,
  token: string,
): boolean {
  const fold = mensaje
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const needle = token
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!needle) {
    return false;
  }
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(fold))) {
    const from = Math.max(0, match.index - 48);
    const to = Math.min(fold.length, match.index + needle.length + 48);
    const window = fold.slice(from, to);
    if (/\bno(?:\s+tenemos|\s+hay|\s+contamos)?\b/.test(window)) {
      return true;
    }
  }
  return false;
}

/** El año pedido está cerca de una negación (no / no hay / no tenemos / no contamos). */
export function respuestaAclaraAnioNoExiste(
  mensaje: string,
  anioPedido: number,
): boolean {
  return respuestaAclaraNoExiste(mensaje, String(anioPedido));
}
