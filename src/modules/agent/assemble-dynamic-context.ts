export type PromptSection = {
  name: string;
  content: string;
};

/** Code in JavaScript3: rol primero, luego el resto. */
export function assembleDynamicContext(sections: PromptSection[]): string {
  const valid = sections.filter((item) => item.name && item.content);
  valid.sort((a, b) => {
    if (a.name === 'rol') {
      return -1;
    }
    if (b.name === 'rol') {
      return 1;
    }
    return 0;
  });

  return valid
    .map((sec) => `\n# ${sec.name.toUpperCase()}\n${sec.content}\n`)
    .join('');
}

export function normalizeIntentName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function promptNamesFromIntents(intents: string[]): string[] {
  const names = new Set<string>(['rol']);
  for (const intent of intents) {
    const clean = normalizeIntentName(intent);
    if (clean) {
      names.add(clean);
    }
  }
  return [...names];
}

export function parseIntentsPayload(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as { intenciones?: unknown };
    if (!Array.isArray(parsed.intenciones)) {
      return [];
    }
    return parsed.intenciones.filter((item): item is string => typeof item === 'string');
  } catch {
    const start = raw.indexOf('{');
    if (start === -1) {
      return [];
    }
    try {
      return parseIntentsPayload(raw.slice(start));
    } catch {
      return [];
    }
  }
}
