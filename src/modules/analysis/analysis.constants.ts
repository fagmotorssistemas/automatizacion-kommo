/** Punto de partida, no un valor medido. Los duplicados vistos caían en el mismo minuto. */
export const DEDUP_WINDOW_MINUTES = 10;

export const ANALYSIS_BATCH_LIMIT = 25;

export const ANALYSIS_LOCK_LEASE_MS = 30 * 60 * 1000;

export const ANALYSIS_INTERVAL_MS = 4 * 60 * 60 * 1000;

export const OPEN_WINDOW_MS = 2 * 60 * 60 * 1000;

export const CLOSE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
