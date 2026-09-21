export const MEMORY_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MEMORY_MAX_MESSAGES = 24;

export const memoryKey = (contactId: string) => `conversation:mem:${contactId}`;
