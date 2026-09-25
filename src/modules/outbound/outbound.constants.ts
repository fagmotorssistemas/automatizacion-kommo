/** Entre cada paquete (enunciado + fotos) cuando piden las de todas. */
export const PHOTO_PACK_GAP_MS = 10_000;

/** El texto ya salió. Las fotos esperan esto para no chocar en el mismo segundo. */
export const PHOTO_AFTER_TEXT_MS = 5_000;

/** Entre un WhatsApp y el siguiente cuando el cron escribe a leads distintos. */
export const LEAD_SEND_GAP_MS = 20_000;
