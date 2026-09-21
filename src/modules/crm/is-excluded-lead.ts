import { KOMMO_EXCLUDED_LEAD_IDS } from './kommo.constants';

export function isExcludedLead(leadId: string): boolean {
  return KOMMO_EXCLUDED_LEAD_IDS.includes(leadId as (typeof KOMMO_EXCLUDED_LEAD_IDS)[number]);
}
