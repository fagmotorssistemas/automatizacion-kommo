const FLAT_PREFIX = 'message[add][0]';

const FLAT_KEYS = {
  id: `${FLAT_PREFIX}[id]`,
  leadId: `${FLAT_PREFIX}[entity_id]`,
  elementId: `${FLAT_PREFIX}[element_id]`,
  chatId: `${FLAT_PREFIX}[chat_id]`,
  talkId: `${FLAT_PREFIX}[talk_id]`,
  contactId: `${FLAT_PREFIX}[contact_id]`,
  text: `${FLAT_PREFIX}[text]`,
  createdAt: `${FLAT_PREFIX}[created_at]`,
  messageType: `${FLAT_PREFIX}[message_type]`,
  direction: `${FLAT_PREFIX}[type]`,
  entityType: `${FLAT_PREFIX}[entity_type]`,
  authorId: `${FLAT_PREFIX}[author][id]`,
  authorType: `${FLAT_PREFIX}[author][type]`,
  authorName: `${FLAT_PREFIX}[author][name]`,
  origin: `${FLAT_PREFIX}[origin]`,
  attachmentType: `${FLAT_PREFIX}[attachment][type]`,
  attachmentLink: `${FLAT_PREFIX}[attachment][link]`,
  attachmentFileName: `${FLAT_PREFIX}[attachment][file_name]`,
} as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function asOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

function firstMessageItem(
  body: Record<string, unknown>,
): Record<string, unknown> | null {
  const message = asRecord(body.message);
  if (!message) {
    return null;
  }

  if (Array.isArray(message.add)) {
    return asRecord(message.add[0]);
  }

  const add = asRecord(message.add);
  if (!add) {
    return null;
  }

  return asRecord(add[0] ?? add['0']);
}

function fromFlat(
  body: Record<string, unknown>,
): Record<string, unknown> | null {
  const hasFlatMessage = Object.keys(body).some((key) =>
    key.startsWith(FLAT_PREFIX),
  );
  if (!hasFlatMessage) {
    return null;
  }

  return {
    messageId: asOptionalString(body[FLAT_KEYS.id]),
    leadId:
      asOptionalString(body[FLAT_KEYS.leadId]) ??
      asOptionalString(body[FLAT_KEYS.elementId]),
    chatId: asOptionalString(body[FLAT_KEYS.chatId]),
    talkId: asOptionalString(body[FLAT_KEYS.talkId]),
    contactId: asOptionalString(body[FLAT_KEYS.contactId]),
    text: asOptionalString(body[FLAT_KEYS.text]),
    createdAt: asOptionalString(body[FLAT_KEYS.createdAt]),
    messageType: asOptionalString(body[FLAT_KEYS.messageType]),
    direction: asOptionalString(body[FLAT_KEYS.direction]),
    entityType: asOptionalString(body[FLAT_KEYS.entityType]),
    authorId: asOptionalString(body[FLAT_KEYS.authorId]),
    authorType: asOptionalString(body[FLAT_KEYS.authorType]),
    authorName: asOptionalString(body[FLAT_KEYS.authorName]),
    origin: asOptionalString(body[FLAT_KEYS.origin]),
    attachmentType: asOptionalString(body[FLAT_KEYS.attachmentType]),
    attachmentLink: asOptionalString(body[FLAT_KEYS.attachmentLink]),
    attachmentFileName: asOptionalString(body[FLAT_KEYS.attachmentFileName]),
  };
}

function fromNested(
  body: Record<string, unknown>,
): Record<string, unknown> | null {
  const item = firstMessageItem(body);
  if (!item) {
    return null;
  }

  const author = asRecord(item.author);
  const attachment = asRecord(item.attachment);

  return {
    messageId: asOptionalString(item.id),
    leadId:
      asOptionalString(item.entity_id) ?? asOptionalString(item.element_id),
    chatId: asOptionalString(item.chat_id),
    talkId: asOptionalString(item.talk_id),
    contactId: asOptionalString(item.contact_id),
    text: asOptionalString(item.text),
    createdAt: asOptionalString(item.created_at),
    messageType: asOptionalString(item.message_type),
    direction: asOptionalString(item.type),
    entityType: asOptionalString(item.entity_type),
    authorId: asOptionalString(author?.id),
    authorType: asOptionalString(author?.type),
    authorName: asOptionalString(author?.name),
    origin: asOptionalString(item.origin),
    attachmentType: asOptionalString(attachment?.type),
    attachmentLink: asOptionalString(attachment?.link),
    attachmentFileName: asOptionalString(attachment?.file_name),
  };
}

/** Kommo manda claves planas; Express/qs a veces las anida. Aceptamos las dos. */
export function extractKommoMessageCandidate(
  body: unknown,
): Record<string, unknown> | null {
  const record = asRecord(body);
  if (!record) {
    return null;
  }

  return fromFlat(record) ?? fromNested(record);
}
