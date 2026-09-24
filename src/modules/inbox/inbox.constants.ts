/** Misma ventana que n8n staticData.seen (5 horas). */
export const MESSAGE_ID_TTL_SECONDS = 5 * 60 * 60;

/** Wait de n8n: 30 s. El webhook no duerme; el job BullMQ sí. */
export const DEBOUNCE_DELAY_MS = 30_000;

/** La lista no debe vivir para siempre si el job no corre. */
export const BUFFER_TTL_SECONDS = 120;

export const messageIdKey = (contactId: string, messageId: string) =>
  `inbox:msg:${contactId}:${messageId}`;

export const bufferKey = (contactId: string) => `inbox:buf:${contactId}`;

export const outboundSentKey = (contactId: string, messageId: string) =>
  `inbox:out:${contactId}:${messageId}`;

export const flushDoneKey = (contactId: string, messageId: string) =>
  `inbox:flush:${contactId}:${messageId}`;

export const flushJobId = (contactId: string, messageId: string) =>
  `inbox-flush:${contactId}:${messageId}`;

/** Un turno a la vez por contacto (evita dos listados del mismo clic). */
export const TURN_LOCK_TTL_SECONDS = 180;
export const turnLockKey = (contactId: string) => `inbox:turn:${contactId}`;

/** Si el candado sigue puesto, reencolar; no tirar el mensaje. */
export const TURN_LOCK_RETRY_DELAY_MS = 12_000;
export const TURN_LOCK_MAX_RETRIES = 2;
export const turnRetryJobId = (
  contactId: string,
  messageId: string,
  attempt: number,
) => `${flushJobId(contactId, messageId)}:lock${attempt}`;
export const turnRetryFlushMessageId = (messageId: string, attempt: number) =>
  `${messageId}:lock${attempt}`;

/** afterReply no puede bloquear el siguiente mensaje del cliente. */
export const INTELLIGENCE_TIMEOUT_MS = 15_000;

/** Ya se mandó una respuesta de arranque; un “sí” no vuelve a listar. */
export const RECENT_OUTBOUND_TTL_SECONDS = 120;
export const recentOutboundKey = (contactId: string) =>
  `inbox:recent:${contactId}`;
