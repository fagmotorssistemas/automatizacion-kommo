export type BufferedMessage = {
  contactId: string;
  messageId: string;
  text: string;
};

export function serializeBufferedMessage(message: BufferedMessage): string {
  return JSON.stringify(message);
}

export function parseBufferedItems(raw: string[]): BufferedMessage[] {
  const items: BufferedMessage[] = [];

  for (const row of raw) {
    try {
      const parsed = JSON.parse(row) as Partial<BufferedMessage>;
      if (parsed.messageId) {
        items.push({
          contactId: parsed.contactId ?? '',
          messageId: parsed.messageId,
          text: parsed.text ?? '',
        });
      }
    } catch {
      // fila vieja o corrupta: se ignora
    }
  }

  return items;
}

/** If1 de n8n, pero compara messageId (dos "hola" no se pisan). */
export function isLatestMessage(
  items: BufferedMessage[],
  messageId: string,
): boolean {
  const last = items[items.length - 1];
  return Boolean(last && last.messageId === messageId);
}

/** Un contacto, una lista. Nunca junta texto de otro contactId. */
export function itemsForContact(
  items: BufferedMessage[],
  contactId: string,
): BufferedMessage[] {
  return items.filter(
    (item) => !item.contactId || item.contactId === contactId,
  );
}

/** Edit Fields4: join con salto de línea. */
export function joinBufferedTexts(items: BufferedMessage[]): string {
  return items.map((item) => item.text).join('\n');
}
