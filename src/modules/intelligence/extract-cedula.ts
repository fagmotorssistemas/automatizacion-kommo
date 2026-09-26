/** Marca del texto que arma la visión cuando la foto es una cédula, no un carro. */
export const CEDULA_PHOTO_MARK = 'Envió foto de su cédula.';

export function formatCedulaPhotoMessage(input: {
  numero: string;
  nombre?: string | null;
  origen?: string | null;
}): string {
  const lines = [CEDULA_PHOTO_MARK, `Número: ${input.numero}`];
  const nombre = input.nombre?.trim();
  const origen = input.origen?.trim();
  if (nombre) {
    lines.push(`Nombre: ${nombre}`);
  }
  if (origen) {
    lines.push(`Origen: ${origen}`);
  }
  return lines.join('\n');
}

function photoLine(text: string, label: string): string | null {
  const match = text.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
  const value = match?.[1]?.trim() ?? '';
  return value || null;
}

/** Número siempre. Nombre y origen solo si el texto viene de la foto de la cédula. */
export function cedulaIdentityFromText(text: string): {
  cedula: string;
  nombre: string | null;
  origen: string | null;
} | null {
  const cedula = extractCedula(text);
  if (!cedula) {
    return null;
  }
  const fromPhoto = text.includes(CEDULA_PHOTO_MARK);
  return {
    cedula,
    nombre: fromPhoto ? photoLine(text, 'Nombre') : null,
    origen: fromPhoto ? photoLine(text, 'Origen') : null,
  };
}

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
