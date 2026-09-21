import { HandoffTurn } from './parse-handoff-turns';

export function formatHandoffTurnsForSummarizer(turns: HandoffTurn[]): string {
  return turns
    .map((turn) => {
      const who =
        turn.role === 'seller'
          ? `Asesor${turn.name ? ` ${turn.name}` : ''}`
          : 'Cliente';
      return `${who}: ${turn.text}`;
    })
    .join('\n');
}
