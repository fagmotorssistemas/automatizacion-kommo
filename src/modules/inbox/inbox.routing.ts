export type InboxRoute = 'waba' | 'other';

/** Equivale al If "source" de n8n: origin === waba. */
export function routeByOrigin(origin: string): InboxRoute {
  return origin === 'waba' ? 'waba' : 'other';
}
