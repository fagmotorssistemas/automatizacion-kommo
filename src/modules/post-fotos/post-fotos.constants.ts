import { KOMMO_SALESBOT } from '../crm/kommo.constants';

/** Cada 1 minuto, como el Schedule Trigger de n8n. */
export const POST_FOTOS_INTERVAL_MS = 60_000;

/** n8n traía limit: 1 por tick. */
export const POST_FOTOS_BATCH_LIMIT = 1;

/** Espera corta tras PATCH del campo antes del salesbot (Wait1 de n8n). */
export const POST_FOTOS_WAIT_MS = 1500;

/** Mismo bot de texto que outbound / n8n bot_id 157134. */
export const POST_FOTOS_SALESBOT_ID = KOMMO_SALESBOT.TEXTO;
