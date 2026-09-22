/** Aviso al cliente cuando el carro tiene UUID pero no bot_id de fotos. */
export const NO_PHOTOS_CUSTOMER_NOTICE =
  'Por ahora no tengo fotos de este vehículo para enviarle. Si desea, le doy más detalles o coordinamos una visita.';

export function appendNoPhotosNotice(mensaje: string): string {
  const text = (mensaje || '').trim();
  if (text.includes('no tengo fotos de este vehículo')) {
    return text;
  }
  if (!text) {
    return NO_PHOTOS_CUSTOMER_NOTICE;
  }
  return `${text}\n\n${NO_PHOTOS_CUSTOMER_NOTICE}`;
}
