/** El bot de n8n guardaba el resumen como type:human. Eso no es voz del cliente. */
export const SYNTHETIC_CUSTOMER_PREFIX = 'RESUMEN PREVIO:';

export function isSyntheticCustomerText(content: string): boolean {
  return content.trimStart().startsWith(SYNTHETIC_CUSTOMER_PREFIX);
}

export function isRealCustomerText(content: string): boolean {
  return Boolean(content.trim()) && !isSyntheticCustomerText(content);
}

export function keepCustomerFacingMessages<
  T extends { role?: string; type?: string; content?: string },
>(items: T[]): T[] {
  return items.filter((item) => {
    const content = item.content ?? '';
    const speaker = item.role || item.type;
    const isHuman = speaker === 'user' || speaker === 'human';
    return Boolean(content) && (!isHuman || isRealCustomerText(content));
  });
}
