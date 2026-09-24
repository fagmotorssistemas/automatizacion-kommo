export const NEGOTIATE_IN_PERSON =
  'Por este medio no podemos ofrecer descuento ni negociar el valor. Le invitamos a venir a la concesionaria para ver la unidad y hablarlo en persona con un asesor; ahí vemos cómo ayudarle.';

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function replySaidNegotiateInPerson(text: string): boolean {
  const n = fold(text);
  return (
    /no podemos (?:ofrecer )?descuento/.test(n) &&
    /hablarlo en persona/.test(n)
  );
}

export function historySaidNegotiateInPerson(
  history?: { role: string; content: string }[],
): boolean {
  return (history ?? []).some(
    (item) =>
      item.role === 'assistant' && replySaidNegotiateInPerson(item.content),
  );
}

export function shouldSayNegotiateInPerson(input: {
  pideNegociar: boolean;
  history?: { role: string; content: string }[];
  reply?: string;
}): boolean {
  if (!input.pideNegociar) {
    return false;
  }
  if (historySaidNegotiateInPerson(input.history)) {
    return false;
  }
  if (input.reply && replySaidNegotiateInPerson(input.reply)) {
    return false;
  }
  return true;
}

export function appendNegotiateInPerson(text: string): string {
  const body = text.trim();
  if (!body) {
    return NEGOTIATE_IN_PERSON;
  }
  if (fold(body).includes(fold(NEGOTIATE_IN_PERSON).slice(0, 32))) {
    return body;
  }
  return `${body}\n\n${NEGOTIATE_IN_PERSON}`;
}
