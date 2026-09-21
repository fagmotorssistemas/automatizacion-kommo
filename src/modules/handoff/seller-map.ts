/** Mapa n8n `responsable`: Kommo responsible_user_id → leads.assigned_to. */
export const KOMMO_SELLER_TO_ASSIGNEE: Record<number, string> = {
  13895303: '16a2bf26-6cba-4aa6-8ede-6c0a87a5443c', // vanessa
  13894775: 'ecce58a4-3962-4f14-970b-b0a0c9873803', // felipe
  14438079: 'b374c77b-3516-4d64-a94d-6c33ee49ddbf', // pedro
  15528168: 'c787d41f-16fb-422d-9b57-f145b941e437', // xavier
};

export const DEFAULT_ASSIGNEE = '920fe992-8f4a-4866-a9b6-02f6009fc7b3';

export function assigneeForKommoUser(userId: number | null): string {
  if (userId && KOMMO_SELLER_TO_ASSIGNEE[userId]) {
    return KOMMO_SELLER_TO_ASSIGNEE[userId];
  }
  return DEFAULT_ASSIGNEE;
}

export function extractResponsibleUserId(raw: unknown): number | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const id = (raw as { responsible_user_id?: unknown }).responsible_user_id;
  const numeric = Number(id);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}
