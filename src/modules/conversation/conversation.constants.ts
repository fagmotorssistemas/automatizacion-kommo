export const MEMORY_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MEMORY_MAX_MESSAGES = 24;

export const memoryKey = (contactId: string) => `conversation:mem:${contactId}`;

export const vehicleKindKey = (contactId: string) =>
  `conversation:vehicle-kind:${contactId}`;

export const vehicleBrandKey = (contactId: string) =>
  `conversation:vehicle-brand:${contactId}`;

export const concreteAskKey = (contactId: string) =>
  `conversation:concrete-ask:${contactId}`;
