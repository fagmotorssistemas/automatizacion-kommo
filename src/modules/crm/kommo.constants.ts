/** IDs reales de Kommo. Auditados con dumps de Get lead. */
export const KOMMO_CUSTOM_FIELD = {
  /**
   * Checkbox "atiende IA?" (field_type: checkbox).
   * true = un humano atiende → el bot se APAGA.
   * Si el campo no viene o no es true → el bot sigue.
   */
  ATIENDE_IA: 2991942,
  /** Textarea "Respuesta IA": texto que dispara el salesbot. */
  RESPUESTA_IA: 2991944,
} as const;

export const KOMMO_CONTACT_FIELD = {
  PHONE_CODE: 'PHONE',
} as const;

export const KOMMO_SALESBOT = {
  TEXTO: 157134,
  ALTA_CONTACTO: 187553,
} as const;

export const KOMMO_EXCLUDED_LEAD_IDS = ['30296877'] as const;
