/** Cédula ecuatoriana: 10 dígitos, provincia 01-24. No es celular (09…). */
export function extractCedula(text: string): string | null {
  const matches = text.match(/(?<!\d)\d{10}(?!\d)/g) ?? [];
  for (const value of matches) {
    if (value.startsWith('09')) {
      continue;
    }
    const province = Number(value.slice(0, 2));
    if (province >= 1 && province <= 24) {
      return value;
    }
  }
  return null;
}

export function cedulaFromThread(
  customerText: string,
  history?: { role: string; content: string }[],
): string | null {
  const fromNow = extractCedula(customerText);
  if (fromNow) {
    return fromNow;
  }
  for (const item of [...(history ?? [])].reverse()) {
    if (item.role !== 'user' && item.role !== 'human') {
      continue;
    }
    const found = extractCedula(item.content);
    if (found) {
      return found;
    }
  }
  return null;
}

export function replyAsksForCedula(text: string): boolean {
  const n = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!/cedula/.test(n)) {
    return false;
  }
  return /pas[ae]|paseme|envi[eé]|compart|necesito|indique|digame|me (da|pasa|envia)/.test(
    n,
  );
}

export function confirmCedulaReceived(carLabel?: string | null): string {
  const unit = carLabel?.trim() ? ` del ${carLabel.trim()}` : '';
  return `Recibí su cédula. Un asesor revisa si califica para el financiamiento${unit}.`;
}
