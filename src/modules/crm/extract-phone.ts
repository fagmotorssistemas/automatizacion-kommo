import { KOMMO_CONTACT_FIELD } from './kommo.constants';

type KommoField = {
  field_code?: string | null;
  field_name?: string | null;
  values?: Array<{ value?: unknown }>;
};

type KommoContact = {
  custom_fields_values?: KommoField[] | null;
};

function asContact(raw: unknown): KommoContact | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  return raw;
}

function fieldValue(field: KommoField | undefined): string | null {
  const value = field?.values?.[0]?.value;
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Saca el teléfono del contacto. No llama a Kommo. */
export function extractPhone(raw: unknown): string | null {
  const contact = asContact(raw);
  const fields = contact?.custom_fields_values;
  if (!Array.isArray(fields)) {
    return null;
  }

  const phoneField = fields.find(
    (field) =>
      field.field_code === KOMMO_CONTACT_FIELD.PHONE_CODE ||
      field.field_name === 'Phone',
  );

  return fieldValue(phoneField);
}
