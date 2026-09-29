/** Aviso al cliente cuando el carro tiene UUID pero no bot_id de fotos. */
export const NO_PHOTOS_CUSTOMER_NOTICE =
  'Por ahora no tengo fotos de este vehículo para enviarle. Si desea, le doy más detalles o coordinamos una visita.';

/** Frases en las que el modelo dice que ya mandó fotos. */
const PHOTO_CLAIM =
  /aqu[ií]\s+(?:tiene|est[aá]n|van)|tiene tambi[eé]n las fotos|le env[ií]o(?:\s+\S+){0,4}\s+las fotos|adjunto(?:\s+\S+){0,3}\s+las fotos|mando(?:\s+\S+){0,3}\s+las fotos|fotos del (?:interior|exterior|veh[ií]culo)/i;

/** Solo la promesa de fotos, no el resto de la frase (ficha, km, color). */
const PHOTO_PHRASE =
  /(?:[,;]?\s*(?:y\s+)?)?(?:aqu[ií]\s+(?:tiene|est[aá]n|van)|tiene\s+tambi[eé]n|le\s+env[ií]o(?:\s+\S+){0,4}|adjunto(?:\s+\S+){0,3}|mando(?:\s+\S+){0,3})(?:\s+tambi[eé]n)?(?:\s+las)?\s+fotos(?:\s+del\s+(?:interior|exterior|veh[ií]culo))?(?:\s+para(?:\s+\S+){0,8})?/gi;

function stripPhotoClause(part: string): string {
  const cleaned = part
    .replace(PHOTO_PHRASE, ' ')
    .replace(
      /^\s*(?:[,;y]\s*)*(?:de(?:l| los| las| este| esta| estos| estas)?\s+)*/i,
      '',
    )
    .replace(/\s+y\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
  if (!cleaned) {
    return '';
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function withoutPhotoClaims(mensaje: string): string {
  const kept = mensaje.split(/(?<=[.!?])\s+/).flatMap((part) => {
    if (!/foto/i.test(part)) {
      return [part];
    }
    if (/no tengo fotos de este veh[ií]culo/i.test(part)) {
      return [part];
    }
    if (!PHOTO_CLAIM.test(part)) {
      return [part];
    }
    const cleaned = stripPhotoClause(part);
    return cleaned && !/^[.,;]+$/.test(cleaned) ? [cleaned] : [];
  });
  return kept
    .join(' ')
    .replace(/\s+([.,])/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** Quita “aquí tiene las fotos” si Nest no va a disparar el SalesBot. */
export function stripUnsentPhotoClaim(mensaje: string): string {
  return withoutPhotoClaims((mensaje || '').trim());
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
