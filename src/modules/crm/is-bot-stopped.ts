import { KOMMO_CUSTOM_FIELD } from './kommo.constants';

type KommoField = {
  field_id?: number;
  values?: Array<{ value?: unknown }>;
};

type KommoLead = {
  custom_fields_values?: KommoField[] | null;
};

/** true = checkbox "atiende IA?" marcado → el bot se apaga. Ausente = sigue. */
export function isBotStopped(raw: unknown): boolean {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return false;
  }

  const fields = (raw as KommoLead).custom_fields_values;
  if (!Array.isArray(fields)) {
    return false;
  }

  const field = fields.find(
    (item) => item.field_id === KOMMO_CUSTOM_FIELD.ATIENDE_IA,
  );

  return field?.values?.[0]?.value === true;
}
