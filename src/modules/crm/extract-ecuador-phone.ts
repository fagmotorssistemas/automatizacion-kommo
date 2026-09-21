/** Regex n8n Code2: celular Ecuador (+593 / 09xxxxxxxx). */
const ECUADOR_PHONE = /(\+?593[\s-]?)?0?9\d{8}/;

/** Saca el primer celular ecuatoriano del texto concatenado. */
export function extractEcuadorPhone(text: string): string | null {
  const match = (text ?? '').match(ECUADOR_PHONE);
  if (!match) {
    return null;
  }

  let phone = match[0].replace(/\s|-/g, '').replace(/^0/, '+593');
  if (!phone.startsWith('+593')) {
    phone = `+593${phone.slice(-9)}`;
  }

  return phone;
}
