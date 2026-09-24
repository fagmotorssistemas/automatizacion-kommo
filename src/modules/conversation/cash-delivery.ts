export const CASH_DELIVERY_CONFIRM =
  'Ese valor es de contado. Hay entrega inmediata una vez que los valores están efectivizados en la empresa.';

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function replyConfirmedCashOrDelivery(text: string): boolean {
  const n = fold(text);
  return (
    /\bcontado\b/.test(n) ||
    /\bentrega inmediata\b/.test(n) ||
    /\bentrega es inmediata\b/.test(n)
  );
}

function sameListedPrice(left: string, right: string): boolean {
  const price = (text: string) =>
    text.match(/\$\s*\d{1,3}(?:[.,]\d{3})+|\$\s*\d{3,6}\b/);
  const a = price(left)?.[0];
  const b = price(right)?.[0];
  return Boolean(a && b && a.replace(/\s/g, '') === b.replace(/\s/g, ''));
}

function foldFichaBody(text: string): string {
  return fold(text)
    .replace(/\$\s*\d{1,3}(?:[.,]\d{3})+|\$\s*\d{3,6}\b/g, ' ')
    .replace(/\b(tiene un precio de|el precio (?:es|de)|precio)\b/g, ' ')
    .replace(/[·•.,;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** El bot solo repitió el $ (o la ficha sin $) y no contestó contado / entrega. */
export function replyOnlyRepeatedPrice(
  reply: string,
  lastAssistant?: string,
): boolean {
  if (replyConfirmedCashOrDelivery(reply)) {
    return false;
  }
  if (!lastAssistant) {
    return false;
  }
  if (sameListedPrice(reply, lastAssistant)) {
    return true;
  }
  const leftover = foldFichaBody(reply);
  const prior = foldFichaBody(lastAssistant);
  return leftover.length >= 24 && prior.length >= 24 && prior.includes(leftover);
}

export function ensureCashDeliveryConfirm(
  text: string,
  lastAssistant?: string,
): string {
  if (replyConfirmedCashOrDelivery(text) && !replyOnlyRepeatedPrice(text, lastAssistant)) {
    return text;
  }
  if (replyOnlyRepeatedPrice(text, lastAssistant)) {
    return CASH_DELIVERY_CONFIRM;
  }
  const body = text.trim();
  return body ? `${body}\n\n${CASH_DELIVERY_CONFIRM}` : CASH_DELIVERY_CONFIRM;
}
