export type MessageKind = 'text' | 'voice' | 'picture';

/** Reemplaza If14 + Switch4: un solo kind, sin nodo Set. */
export function classifyMessageKind(input: {
  attachmentType?: string;
  messageType?: string;
}): MessageKind {
  const type = (input.attachmentType || input.messageType || '')
    .trim()
    .toLowerCase();

  if (type === 'voice') {
    return 'voice';
  }
  if (type === 'picture') {
    return 'picture';
  }
  return 'text';
}
