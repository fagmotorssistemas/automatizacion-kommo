export type HandoffTurn = {
  role: 'customer' | 'seller';
  name: string | null;
  text: string;
  at: string;
};

export function parseHandoffTurns(raw: unknown): HandoffTurn[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const turns: HandoffTurn[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const row = item as { role?: unknown; name?: unknown; text?: unknown; at?: unknown };
    const role = row.role === 'seller' ? 'seller' : row.role === 'customer' ? 'customer' : null;
    const text = typeof row.text === 'string' ? row.text.trim() : '';
    if (!role || !text) {
      continue;
    }
    turns.push({
      role,
      name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : null,
      text,
      at: typeof row.at === 'string' ? row.at : '',
    });
  }
  return turns;
}

/** Turnos listos para el agente: user / assistant. */
export function handoffTurnsToAgentMessages(
  turns: HandoffTurn[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return turns.map((turn) =>
    turn.role === 'seller'
      ? {
          role: 'assistant' as const,
          content: `[Asesor${turn.name ? ` ${turn.name}` : ''}]: ${turn.text}`,
        }
      : { role: 'user' as const, content: turn.text },
  );
}
