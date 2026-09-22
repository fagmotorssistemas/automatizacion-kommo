/** Cada 1 minuto. */
export const POST_FOTOS_INTERVAL_MS = 60_000;

export const POST_FOTOS_BATCH_LIMIT = 5;

/** Espera corta tras PATCH antes del salesbot. */
export const POST_FOTOS_WAIT_MS = 1500;

export type PostFotosPaso = 1 | 2 | 3;

/** Delays de reloj desde el ancla (fotos o último envío nuestro). */
export const POST_FOTOS_DELAY_MS: Record<PostFotosPaso, number> = {
  1: 40 * 60 * 1000,
  2: 3 * 60 * 60 * 1000,
  3: 6 * 60 * 60 * 1000,
};
