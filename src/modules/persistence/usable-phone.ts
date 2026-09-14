const PLACEHOLDER = /^(sin número|sin numero)$/i;

/** n8n guarda 'Sin número'; el RPC no debe correr con eso. */
export function usablePhone(phone: string | null | undefined): string | null {
  if (!phone) {
    return null;
  }

  const trimmed = phone.trim();
  if (!trimmed || PLACEHOLDER.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function phoneForLeadColumn(phone: string | null | undefined): string {
  return usablePhone(phone) ?? 'Sin número';
}
