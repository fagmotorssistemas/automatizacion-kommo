/** Aviso al cliente cuando el carro tiene UUID pero no bot_id de fotos. */
export const NO_PHOTOS_CUSTOMER_NOTICE =
  'Por ahora no tengo fotos de este vehículo para enviarle. Si desea, le doy más detalles o coordinamos una visita.';

/** Frases en las que el modelo dice que ya mandó fotos. */
const PHOTO_CLAIM =
  /aqu[ií]\s+(?:tiene|est[aá]n|van)|tiene tambi[eé]n las fotos|le env[ií]o las fotos|adjunto las fotos|mando las fotos|fotos del veh[ií]culo/i;

function withoutPhotoClaims(mensaje: string): string {
  const kept = mensaje
    .split(/(?<=[.!?])\s+/)
    .filter((part) => {
      if (!/foto/i.test(part)) {
        return true;
      }
      if (/no tengo fotos de este veh[ií]culo/i.test(part)) {
        return true;
      }
      return !PHOTO_CLAIM.test(part);
    });
  return kept.join(' ').replace(/[ \t]+\n/g, '\n').trim();
}

export function appendNoPhotosNotice(mensaje: string): string {
  const raw = (mensaje || '').trim();
  if (
    raw.includes('no tengo fotos de este vehículo') &&
    !PHOTO_CLAIM.test(raw)
  ) {
    return raw;
  }
  const text = withoutPhotoClaims(raw);
  if (text.includes('no tengo fotos de este vehículo')) {
    return text;
  }
  if (!text) {
    return NO_PHOTOS_CUSTOMER_NOTICE;
  }
  return `${text}\n\n${NO_PHOTOS_CUSTOMER_NOTICE}`;
}
