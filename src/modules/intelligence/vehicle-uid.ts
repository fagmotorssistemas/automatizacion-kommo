/** car_unico: FNV-1a de lead_id|inventory_id. */
export function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
}

export function buildVehicleUid(
  leadId: string,
  inventoryId?: string | null,
): string | null {
  if (!leadId || !inventoryId) {
    return null;
  }
  return fnv1a(`${leadId}|${inventoryId}`);
}
