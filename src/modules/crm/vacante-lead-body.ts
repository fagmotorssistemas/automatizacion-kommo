export type LeadTagRef = {
  id?: number;
  name?: string;
};

/** null: el GET no trajo tags; no se manda _embedded.tags para no borrar las que ya tiene. */
export function readLeadTags(raw: unknown): LeadTagRef[] | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const tags = (raw as { _embedded?: { tags?: unknown } })._embedded?.tags;
  if (!Array.isArray(tags)) {
    return null;
  }

  return tags.map((tag) => {
    const row = tag as { id?: unknown; name?: unknown };
    const id = Number(row.id);
    return {
      ...(Number.isFinite(id) && id > 0 ? { id } : {}),
      ...(typeof row.name === 'string' && row.name.trim()
        ? { name: row.name.trim() }
        : {}),
    };
  });
}

export function vacanteLeadBody(input: {
  leadId: number;
  tagName: string;
  responsibleUserId: number | null;
  tags: LeadTagRef[] | null;
}): Record<string, unknown> {
  const body: Record<string, unknown> = { id: input.leadId };
  if (input.responsibleUserId) {
    body.responsible_user_id = input.responsibleUserId;
  }

  if (!input.tags) {
    return body;
  }

  const already = input.tags.some(
    (tag) => tag.name?.trim().toLowerCase() === input.tagName.toLowerCase(),
  );
  const kept = input.tags
    .filter((tag) => tag.id)
    .map((tag) => ({ id: tag.id }));
  body._embedded = {
    tags: already ? kept : [...kept, { name: input.tagName }],
  };
  return body;
}
